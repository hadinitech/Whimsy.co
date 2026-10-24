// Isolated browser checks. HTTP stubs never write to the live project.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
mkdirSync('artifacts',{recursive:true});
const origin='https://whimsy-community-test.supabase.co';
const server=await createServer({server:{host:'127.0.0.1',port:5179,strictPort:true},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(origin),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('sb_publishable_community_test')}});
await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:900}});page.setDefaultTimeout(10000);
const user={id:'11111111-1111-4111-8111-111111111111',email:'customer@example.test',aud:'authenticated',role:'authenticated',user_metadata:{full_name:'Test Customer'},app_metadata:{},identities:[],created_at:new Date().toISOString()};
const token=`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.test`;
let shares=[],files=new Set(),admin=false,failInsert=false;
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route(`${origin}/**`,async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
  if(method==='OPTIONS')return json({});
  if(url.pathname.startsWith('/storage/v1/object/sign/'))return json({signedURL:'/object/sign/community/test.png?token=test'});
  if(url.pathname.startsWith('/storage/v1/object/community/')&&method==='POST'){files.add(decodeURIComponent(url.pathname.split('/community/')[1]));return json({Key:url.pathname},200);}
  const body=req.postData()?JSON.parse(req.postData()):{};
  if(url.pathname==='/storage/v1/object/community'&&method==='DELETE'){for(const path of body.prefixes)files.delete(path);return json([]);}
  if(url.pathname==='/auth/v1/token')return json({access_token:token,refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user});
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/auth/v1/logout')return json({});
  if(url.pathname==='/rest/v1/rpc/is_store_admin')return json(admin);
  if(url.pathname==='/rest/v1/products')return json([]);
  if(url.pathname==='/rest/v1/store_settings')return json(method==='GET'&&url.searchParams.has('id')?{id:1,checkout_enabled:false}:[{id:1,checkout_enabled:false}]);
  if(url.pathname==='/rest/v1/profiles')return json(method==='POST'?null:{id:user.id,full_name:'Test Customer'});
  if(['/rest/v1/favourites','/rest/v1/cart_items','/rest/v1/orders'].includes(url.pathname))return json([]);
  if(url.pathname.startsWith('/rest/v1/rpc/'))return json(null);
  if(url.pathname==='/rest/v1/community_shares'){
    if(method==='POST'){
      if(failInsert){failInsert=false;return json({message:'Test save failure'},500);}
      const row={...body,status:'pending',created_at:new Date().toISOString()};shares.push(row);return json(row,201);
    }
    if(method==='PATCH'){const row=shares.find(row=>`eq.${row.id}`===url.searchParams.get('id'));row.status=body.status;return json([{id:row.id}]);}
    if(method==='DELETE'){const id=url.searchParams.get('id');const rows=shares.filter(row=>`eq.${row.id}`===id);shares=shares.filter(row=>`eq.${row.id}`!==id);return json(rows);}
    return json(url.searchParams.get('status')==='eq.approved'?shares.filter(row=>row.status==='approved'):shares);
  }
  return json({message:`Unexpected endpoint ${url.pathname}`},400);
});
// The signed image route is local to the mock storage service.
await page.route(`${origin}/storage/v1/object/sign/community/test.png?*`,route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64')}));
const base='http://127.0.0.1:5179';
async function login(){await page.goto(`${base}/account.html?next=shares`);await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('Test-password-123');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/account.html#shares');}
async function fill(form,caption,photo=false){await form.locator('[name=kind]').selectOption(photo?'photo':'review');await form.locator('[name=display_name]').fill('A little whimsy');await form.locator('[name=caption]').fill(caption);if(photo)await form.locator('[type=file]').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64')});await form.locator('[name=consent]').check();await form.getByRole('button',{name:'Submit for review'}).click();}
try{
  await page.goto(base);await page.locator('.social-grid button').first().waitFor();assert.equal(await page.locator('.social-grid button').count(),4);
  await page.locator('[data-open-community=review]').click();await page.getByRole('link',{name:'Sign in to share'}).waitFor();await page.getByRole('button',{name:'Close share form'}).click();
  await login();await page.getByRole('link',{name:'My shares',exact:true}).first().click();
  await page.getByText('Share something new',{exact:true}).click();
  const form=page.locator('.community-form');await fill(form,'My review <script>window.bad=true</script>');
  await page.locator('.community-result').filter({hasText:'Saved!'}).waitFor();assert.equal(shares.length,1);assert.equal(shares[0].status,'pending');
  await page.reload();await page.locator('.community-card').waitFor();assert.equal(await page.locator('.community-card').count(),1);assert.equal(await page.evaluate(()=>window.bad),undefined);
  await page.getByText('Share something new',{exact:true}).click();await fill(page.locator('.community-form'),'My photo',true);
  await page.locator('.community-result').filter({hasText:'Saved!'}).waitFor();assert.equal(files.size,1);assert.ok(shares[1].image_path.startsWith(`${user.id}/`));
  await page.screenshot({path:'artifacts/community-customer.png'});
  failInsert=true;await fill(page.locator('.community-form'),'Retry photo',true);await page.getByRole('status').filter({hasText:'Test save failure'}).waitFor();assert.equal(shares.length,2);assert.equal(files.size,1,'Failed row insert cleans up uploaded photo');
  admin=true;await page.goto(`${base}/admin.html#shares`);await page.getByRole('heading',{name:'Community shares'}).waitFor();
  await page.locator('.community-card').filter({hasText:'My review'}).getByRole('button',{name:'Publish',exact:true}).click();
  await page.locator('.community-card').filter({hasText:'My review'}).getByText('Published',{exact:true}).waitFor();assert.equal(shares[0].status,'approved');assert.equal(shares[1].status,'pending');
  await page.screenshot({path:'artifacts/community-owner.png'});
  await page.locator('.community-card').filter({hasText:'My review'}).getByRole('button',{name:'Unpublish',exact:true}).click();
  await page.locator('.community-card').filter({hasText:'My review'}).getByText('Not published',{exact:true}).waitFor();assert.equal(shares[0].status,'rejected');
  await page.locator('.community-card').filter({hasText:'My review'}).getByRole('button',{name:'Publish',exact:true}).click();
  await page.locator('.community-card').filter({hasText:'My review'}).getByText('Published',{exact:true}).waitFor();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('.community-card').filter({hasText:'My photo'}).getByRole('button',{name:'Delete',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.community-card').length===1);assert.equal(files.size,0);assert.equal(shares.length,1);
  await page.evaluate(()=>localStorage.clear());await page.goto(base);await page.locator('.social-grid .community-card').waitFor();assert.equal(await page.locator('.social-grid .community-card').count(),1);assert.equal(await page.locator('.social-grid').getByText('My photo',{exact:true}).count(),0);
  await page.locator('[data-open-community=photo]').click();await page.getByRole('button',{name:'Close share form'}).click();await page.locator('[data-open-community=photo]').click();assert.equal(await page.locator('dialog[open]').count(),1);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);console.log('Community browser checks passed: sign-in, persisted reviews/photos, upload cleanup, dashboard history, owner publication, public moderation, escaping and mobile form.');
}finally{await browser.close();await server.close();}
