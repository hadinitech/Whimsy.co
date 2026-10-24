// Isolated catalogue/auth/favourites integration checks; no live writes.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { SAMPLE_PRODUCTS } from '../src/catalog.js';
const origin='https://whimsy-shop-test.supabase.co';
const server=await createServer({server:{host:'127.0.0.1',port:5178,strictPort:true},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(origin),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('sb_publishable_catalogue_test')}});
await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:950}});
page.setDefaultTimeout(10000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const user={id:'11111111-1111-4111-8111-111111111111',email:'customer@example.test',aud:'authenticated',role:'authenticated',user_metadata:{full_name:'Test Customer'},app_metadata:{},identities:[],created_at:new Date().toISOString()};
const token=`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.test`;
const products=SAMPLE_PRODUCTS.map((p,i)=>({...p,price_cents:p.price*100,stock_quantity:i===1?0:8,sort_order:p.order,active:i!==23,image_url:i===0?'https://image.example.test/missing.png':'',description:''}));
let favourites=[],cart=[];
await page.route('https://image.example.test/**',route=>route.fulfill({status:404,body:''}));
await page.route(`${origin}/**`,async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method(),body=req.postData()?JSON.parse(req.postData()):{};
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
  if(method==='OPTIONS')return json({});
  if(url.pathname==='/auth/v1/token')return json({access_token:token,refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user});
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/auth/v1/logout')return json({});
  if(url.pathname==='/rest/v1/products')return json(products.filter(p=>p.active));
  if(url.pathname==='/rest/v1/store_settings')return json({id:1,checkout_enabled:false});
  if(url.pathname==='/rest/v1/profiles')return json(null);
  if(url.pathname==='/rest/v1/orders')return json([]);
  if(url.pathname==='/rest/v1/rpc/is_store_admin')return json(false);
  if(url.pathname==='/rest/v1/cart_items')return json(cart);
  if(url.pathname==='/rest/v1/rpc/merge_guest_cart'){cart=body.items;return json(null);}
  if(url.pathname==='/rest/v1/rpc/set_cart_quantity'){cart=[{product_id:body.product,quantity:body.amount}];return json(null);}
  if(url.pathname==='/rest/v1/favourites'){
    if(method==='POST'){for(const row of Array.isArray(body)?body:[body]){assert.equal(row.user_id,user.id);if(!favourites.some(f=>f.product_id===row.product_id))favourites.push(row);}return json(null,201);}
    if(method==='DELETE'){assert.equal(url.searchParams.get('user_id'),`eq.${user.id}`);favourites=favourites.filter(f=>`eq.${f.product_id}`!==url.searchParams.get('product_id'));return json(null);}
    return json(favourites);
  }
  return json({message:`Unhandled ${url.pathname}`},500);
});
const card=id=>page.locator(`.product-card[data-id="${id}"]`);
try{
  await page.goto('http://127.0.0.1:5178/shop.html');
  await page.locator('#whimsy-page-loader').waitFor({state:'hidden'});
  assert.equal(await page.locator('.product-card').count(),23);
  assert.equal(await page.locator('#catalogue-count').textContent(),'23');
  assert.equal(await card('p24').count(),0);
  assert.ok((await page.locator('#grid1').boundingBox()).y<500,'Products appear directly under hero/controls');
  await card('p1').locator('.catalogue-fallback-slot').waitFor({state:'visible'});
  assert.equal(await card('p2').locator('.catalogue-add').isDisabled(),true);
  await card('p1').locator('[data-favourite]').click();
  await page.waitForFunction(()=>document.querySelector('[data-favourite="p1"]').getAttribute('aria-pressed')==='true');
  await page.reload();
  await card('p1').locator('[aria-pressed=true]').waitFor();
  await page.getByRole('button',{name:'Favourites',exact:true}).click();
  await page.locator('#whimsy-page-loader').waitFor({state:'hidden'});
  assert.equal(await page.locator('.product-card').count(),1);
  await card('p1').locator('[data-favourite]').click();
  await page.getByRole('heading',{name:'No chaos found here.'}).waitFor();
  await page.getByRole('button',{name:'View all products'}).click();
  await card('p1').locator('[data-favourite]').click();
  await card('p1').locator('.catalogue-add').click();
  assert.equal(new URL(page.url()).pathname,'/shop.html');
  await page.getByRole('button',{name:'Cart',exact:true}).click();
  await page.getByLabel('Quantity',{exact:true}).filter({hasText:'1'}).waitFor();
  await page.goto('http://127.0.0.1:5178/shop.html');
  await page.locator('.cat-tab[data-cat=keychains]').click();
  assert.ok(await page.locator('.product-card').count()>0);
  assert.ok(await page.locator('.pname').evaluateAll(links=>links.every(a=>/keychain/i.test(a.textContent))));
  await page.locator('.cat-tab[data-cat=all]').click();
  await page.getByRole('searchbox',{name:'Search products'}).fill('nothing matching');
  await page.getByRole('heading',{name:'No chaos found here.'}).waitFor();
  await page.getByRole('button',{name:'View all products'}).click();
  await page.getByRole('combobox',{name:'Sort products'}).selectOption('lowhigh');
  const prices=await page.locator('.catalogue-price').allTextContents();
  assert.match(prices[0],/95/);
  await page.getByRole('button',{name:/Filter/}).click();
  await page.getByLabel('In stock only').check();
  assert.equal(await card('p2').count(),0);
  await page.getByRole('button',{name:'Clear all filters'}).click();
  await page.getByRole('button',{name:/Filter/}).click();
  mkdirSync('artifacts',{recursive:true});await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:'artifacts/catalogue-desktop.png',fullPage:true});
  const credit=page.getByRole('link',{name:'Hadini Holdings',exact:true});assert.equal(await credit.count(),1);assert.equal(await credit.getAttribute('href'),'https://HadiniHoldings.co.za');
  for(const width of [850,650,390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Shop fits ${width}px`);if(width===390)await page.screenshot({path:'artifacts/catalogue-mobile.png',fullPage:true});}
  await page.setViewportSize({width:1200,height:950});
  await page.goto('http://127.0.0.1:5178/account.html');
  await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('heading',{name:'Welcome back, Test'}).waitFor();
  assert.ok(favourites.some(row=>row.product_id==='p1'),'Guest favourite merged to account');
  await page.goto('http://127.0.0.1:5178/shop.html?favourites=1');
  await card('p1').locator('[aria-pressed=true]').waitFor();
  await page.reload();await card('p1').locator('[aria-pressed=true]').waitFor();
  await card('p1').locator('[data-favourite]').click();
  await page.getByRole('heading',{name:'No chaos found here.'}).waitFor();assert.equal(favourites.length,0);
  assert.deepEqual(errors,[]);
  console.log('Catalogue checks passed: actual visible data, compact grid, missing/broken image fallback, stock, categories, search, sort, filters, guest/account favourites, existing cart, credit and mobile layouts.');
}catch(error){console.error(await page.locator('body').innerText());console.error(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right})).slice(0,18)));throw error;}
finally{await browser.close();await server.close();}
