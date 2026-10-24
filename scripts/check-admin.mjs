// UI integration checks use simulated Supabase HTTP responses, never live writes.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { SAMPLE_PRODUCTS } from '../src/catalog.js';
const origin='https://whimsy-admin-test.supabase.co';
const server=await createServer({server:{host:'127.0.0.1',port:5176,strictPort:true},define:{
  'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(origin),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('sb_publishable_ui_test_only')
}});
await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:800}});
page.setDefaultTimeout(10000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const user={id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{full_name:'Other Name'},identities:[],created_at:new Date().toISOString()};
const token=`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.test`;
let products=SAMPLE_PRODUCTS.map((p,i)=>({...p,price_cents:p.price*100,stock_quantity:i===1?3:i===2?12:0,sort_order:p.order,active:i!==3,description:'',image_url:''}));
let orders=[],failWrite=false,failUpload=false,uploadCalls=0;
const uploadedFiles=new Set();
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
await page.route(`${origin}/**`,async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method();
  const json=(body,status=200,count)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-expose-headers':'content-range',...(count===undefined?{}:{'content-range':`0-${Math.max(0,count-1)}/${count}`})}});
  if(method==='OPTIONS')return json({});
  if(url.pathname.startsWith('/storage/v1/object/public/product-images/'))return route.fulfill({status:200,contentType:'image/png',body:png});
  if(url.pathname.startsWith('/storage/v1/object/product-images/')&&method==='POST'){
    uploadCalls++;if(failUpload){failUpload=false;return json({message:'Test upload failure',statusCode:400},400);}
    uploadedFiles.add(url.pathname.split('/product-images/')[1]);return json({Key:url.pathname},200);
  }
  const body=request.postData()?JSON.parse(request.postData()):{};
  if(url.pathname==='/storage/v1/object/product-images'&&method==='DELETE'){for(const path of body.prefixes)uploadedFiles.delete(path);return json([]);}
  if(url.pathname==='/auth/v1/token')return json({access_token:token,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user});
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/auth/v1/logout')return json({});
  if(url.pathname==='/rest/v1/rpc/is_store_admin')return json(true);
  if(url.pathname==='/rest/v1/profiles')return json({id:user.id,full_name:'Avery Storeowner'});
  if(url.pathname==='/rest/v1/cart_items')return json([]);
  if (url.pathname === '/rest/v1/favourites') return json([]);
  if(url.pathname==='/rest/v1/store_settings')return json({id:1,checkout_enabled:false,shipping_cents:null,free_shipping_threshold_cents:null,vat_registered:null,payment_provider:null});
  if(url.pathname==='/rest/v1/products'){
    if(method==='POST'||method==='PATCH'){
      if(failWrite){failWrite=false;return json({message:'Test save failure. Please try again.',code:'42501'},403);}
      if(method==='POST'){
        const existing=products.find(p=>p.id===body.id);
        if(existing)Object.assign(existing,body);else products.push({...body,icon:'tote',mood:'',badge:'',rating:0});
      }else{
        const id=url.searchParams.get('id')?.replace('eq.','');Object.assign(products.find(p=>p.id===id),body);
        return json([{id}]);
      }
      return json(null,201);
    }
    if(url.searchParams.has('image_url'))return json(products.filter(p=>`eq.${p.image_url}`===url.searchParams.get('image_url')));
    return json(url.searchParams.get('active')==='eq.true'?products.filter(p=>p.active):products);
  }
  if(url.pathname==='/rest/v1/orders')return json(orders,200,orders.length);
  if(url.pathname==='/rest/v1/rpc/fulfill_order'){
    const order=orders.find(o=>o.id===body.order_id);order.status='fulfilled';order.tracking_reference=body.tracking;return json(null);
  }
  return json({message:`Unhandled test endpoint: ${url.pathname}`},500);
});
const section=()=>page.locator('#admin-section');
try{
  await page.goto('http://127.0.0.1:5176/account.html');
  await page.getByLabel('Email',{exact:true}).fill(user.email);
  await page.getByLabel('Password',{exact:true}).fill('test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForURL('**/admin.html');
  await page.getByRole('heading',{name:'Welcome back, Avery'}).waitFor();
  await page.locator('tr[data-product-id]').first().waitFor();
  assert.equal(await page.locator('tr[data-product-id]').count(),24);
  assert.equal(await page.locator('tr[data-product-id="p1"] .admin-status').innerText(),'Out of stock');
  assert.equal(await page.locator('tr[data-product-id="p2"] .admin-status').innerText(),'Low stock');
  assert.equal(await page.locator('tr[data-product-id="p3"] .admin-status').innerText(),'In stock');
  assert.equal(await page.locator('.admin-metric').nth(0).locator('strong').innerText(),'24');
  assert.equal(await page.locator('.admin-metric').nth(1).locator('strong').innerText(),'2');
  assert.equal(await page.locator('.admin-metric').nth(2).locator('strong').innerText(),'1');
  assert.equal(await page.locator('.admin-metric').nth(3).locator('strong').innerText(),'0');
  mkdirSync('artifacts',{recursive:true});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:'artifacts/admin-desktop.png'});
  const sidebarBefore=await page.locator('.admin-sidebar').boundingBox();
  await page.locator('.admin-content').evaluate(el=>el.scrollTop=500);
  assert.deepEqual(await page.locator('.admin-sidebar').boundingBox(),sidebarBefore);
  assert.ok(await page.locator('.admin-sidebar').evaluate(el=>el.scrollHeight<=el.clientHeight));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight),800);
  await page.locator('.admin-content').evaluate(el=>el.scrollTop=0);
  await page.getByRole('searchbox',{name:'Search products'}).fill('gremlin');
  assert.equal(await page.locator('tr[data-product-id]').count(),1);
  await page.getByRole('searchbox',{name:'Search products'}).fill('');
  await page.locator('[data-filter="out"]').click();
  assert.equal(await page.locator('tr[data-product-id]').count(),22);
  await page.locator('[data-filter="all"]').click();
  const row=()=>page.locator('tr[data-product-id="p1"]');
  await row().locator('summary').click();
  await row().getByRole('button',{name:'Edit product',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Edit product',exact:true});
  await dialog.getByLabel('Name',{exact:true}).fill('Updated Whimsy Tote');
  await dialog.getByLabel('Stock quantity').fill('8');
  await dialog.getByLabel('Price (R)').fill('499.50');
  assert.equal(await dialog.locator('input[type=url]').count(),0);
  await dialog.getByLabel('Product image',{exact:true}).setInputFiles({name:'image.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
  assert.equal(await dialog.locator('#edit-image').evaluate(el=>el.checkValidity()),false);
  await dialog.getByLabel('Product image',{exact:true}).setInputFiles({name:'product.png',mimeType:'image/png',buffer:png});
  await dialog.locator('.admin-image-preview').waitFor({state:'visible'});
  assert.ok((await dialog.locator('.admin-image-preview').getAttribute('src')).startsWith('blob:'));
  failUpload=true;
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await dialog.locator('.form-result').filter({hasText:'Test upload failure'}).waitFor();
  assert.equal(products.find(p=>p.id==='p1').image_url,'');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await dialog.waitFor({state:'hidden'});
  await row().getByText('Updated Whimsy Tote').waitFor();
  assert.equal(products.find(p=>p.id==='p1').price_cents,49950);
  const savedImage=products.find(p=>p.id==='p1').image_url;
  assert.ok(savedImage.startsWith(`${origin}/storage/v1/object/public/product-images/p1/`));
  assert.equal(uploadedFiles.size,1);
  await row().locator('summary').click();await row().getByRole('button',{name:'Edit product',exact:true}).click();
  assert.equal(await dialog.locator('.admin-image-preview').getAttribute('src'),savedImage);
  const callsBefore=uploadCalls;
  await dialog.getByRole('button',{name:'Save changes'}).click();await dialog.waitFor({state:'hidden'});
  assert.equal(products.find(p=>p.id==='p1').image_url,savedImage);assert.equal(uploadCalls,callsBefore);
  await row().locator('summary').click();
  await row().getByRole('button',{name:'Hide from shop'}).click();
  await row().getByText('Hidden from shop').waitFor();
  await page.getByRole('button',{name:'Add product',exact:true}).click();
  const create=page.getByRole('dialog',{name:'Add product',exact:true});
  await create.getByLabel('Name',{exact:true}).fill('New Test Pin');
  await create.getByLabel('Price (R)').fill('89');
  await create.getByLabel('Stock quantity').fill('2');
  await create.getByLabel('Description').fill('A new product description');
  await create.getByLabel('Visible in shop').check();
  await create.getByLabel('New drop').check();
  await create.getByLabel('Bestseller').check();
  await create.getByLabel('Product image',{exact:true}).setInputFiles({name:'new-product.png',mimeType:'image/png',buffer:png});
  failWrite=true;
  await create.getByRole('button',{name:'Add product',exact:true}).click();
  await create.getByText('Test save failure. Please try again.').waitFor();
  assert.equal(uploadedFiles.size,1,'A failed product save removes its unused upload');
  await create.getByRole('button',{name:'Add product',exact:true}).click();
  await create.waitFor({state:'hidden'});
  await page.locator('tr[data-product-id="p25"]').waitFor();
  assert.deepEqual(products.find(p=>p.id==='p25').collections,['new','bestseller']);
  assert.ok(products.find(p=>p.id==='p25').image_url.includes('/product-images/p25/'));
  assert.equal(uploadedFiles.size,2);
  await page.locator('.admin-sidebar [data-section="inventory"]').click();
  await section().getByRole('heading',{name:'Inventory',exact:true}).waitFor();
  const stockForm=page.locator('[data-stock="p1"]');
  await stockForm.getByRole('spinbutton').fill('0');
  await stockForm.getByRole('button',{name:/Save stock/}).click();
  await page.locator('tr[data-product-id="p1"] .admin-status').filter({hasText:'Out of stock'}).waitFor();
  await page.locator('.admin-sidebar [data-section="orders"]').click();
  await page.getByText('Your first order starts a little story.').waitFor();
  await page.getByRole('link',{name:/View store settings/}).click();
  await section().getByRole('heading',{name:'Settings',exact:true}).waitFor();
  assert.equal(await section().getByText('Not configured',{exact:true}).count(),4);
  assert.equal(await section().locator('input,select').count(),0);
  orders=[{id:'44444444-4444-4444-8444-444444444444',status:'paid',created_at:new Date().toISOString(),customer_email:'customer@example.test',total_cents:45000,shipping_cents:0,tax_cents:0,delivery_address:{city:'Cape Town'},order_items:[{product_name:'Purchased Tote',quantity:1,unit_price_cents:45000}]}];
  await page.locator('.admin-sidebar [data-section="orders"]').click();
  await page.getByLabel('Tracking reference').fill('TRACK-TEST');
  await page.getByRole('button',{name:'Mark fulfilled'}).click();
  await page.getByText('Tracking: TRACK-TEST').waitFor();
  assert.equal(orders[0].status,'fulfilled');
  assert.equal(await page.locator('.admin-metric').nth(3).locator('strong').innerText(),'1');
  await page.locator('.admin-sidebar [data-section="products"]').click();
  for(const width of [1024,768,650,390,320]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No horizontal page overflow at ${width}px`);
    assert.ok(await page.locator('.admin-content').evaluate(el=>el.scrollWidth<=el.clientWidth),`Main content fits ${width}px`);
    if(width===390){await page.evaluate(()=>document.querySelector('.store-notice')?.classList.remove('visible'));await page.screenshot({path:'artifacts/admin-mobile.png'});}
  }
  await page.getByRole('button',{name:'Open dashboard navigation'}).click();
  await page.getByRole('dialog',{name:'Dashboard navigation'}).getByRole('link',{name:'Inventory',exact:true}).click();
  await section().getByRole('heading',{name:'Inventory',exact:true}).waitFor();
  assert.equal(await page.locator('.admin-nav-dialog').getAttribute('open'),null);
  await page.getByRole('button',{name:'Open dashboard navigation'}).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.admin-nav-dialog').getAttribute('open'),null);
  assert.deepEqual(errors,[]);
  console.log('Dashboard browser checks passed: live-shaped metrics, accurate stock statuses, search/filters, product edit/add/visibility, save error recovery, quick stock updates, orders/fulfillment, settings, fixed sidebar, mobile navigation and layout. No live data was modified.');
}catch(error){console.error(await page.locator('body').innerText());throw error;}
finally{await browser.close();await server.close();}
