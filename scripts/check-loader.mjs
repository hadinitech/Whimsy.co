// Gate actual HTTP responses in this test; the app itself has no splash timer.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { SAMPLE_PRODUCTS } from '../src/catalog.js';
const origin='https://whimsy-loader-test.supabase.co';
const server=await createServer({server:{host:'127.0.0.1',port:5177,strictPort:true},define:{
  'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(origin),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('sb_publishable_loading_test')
}});
await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1048,height:655}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
let releaseProducts,seenProducts,failProducts=false;
const productsGate=new Promise(resolve=>releaseProducts=resolve);
const productsRequested=new Promise(resolve=>seenProducts=resolve);
await page.route(`${origin}/**`,async route=>{
  const url=new URL(route.request().url());
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
  if(route.request().method()==='OPTIONS')return json({});
  if(url.pathname==='/rest/v1/products'){
    seenProducts();await productsGate;
    return failProducts?json({message:'Test catalog unavailable'},503):json(SAMPLE_PRODUCTS.map(p=>({...p,price_cents:p.price*100,stock_quantity:p.stock?5:0,sort_order:p.order,active:true})));
  }
  if(url.pathname==='/rest/v1/store_settings')return json({id:1,checkout_enabled:false});
  return json({});
});
try{
  await page.goto('http://127.0.0.1:5177/shop.html',{waitUntil:'commit'});
  await productsRequested;
  const loader=page.locator('#whimsy-page-loader');
  await loader.waitFor({state:'visible'});
  assert.equal(await page.locator('main').getAttribute('aria-busy'),'true');
  assert.equal(await page.locator('main').evaluate(el=>el.inert),true);
  assert.equal(await page.locator('.product-card').count(),0);
  mkdirSync('artifacts',{recursive:true});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:'artifacts/loader-desktop.png'});
  const transform=await loader.locator('.whimsy-loader-ring').evaluate(el=>getComputedStyle(el).transform);
  await page.waitForFunction(first=>getComputedStyle(document.querySelector('#whimsy-page-loader .whimsy-loader-ring')).transform!==first,transform);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await loader.locator('.whimsy-loader-ring').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'artifacts/loader-mobile.png'});
  releaseProducts();
  await loader.waitFor({state:'hidden'});
  assert.equal(await page.locator('.product-card').count(),24);
  assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
  assert.equal(await page.locator('main').getAttribute('aria-busy'),null);
  // Concurrent waits must not dismiss one another's overlay.
  await page.evaluate(async()=>{const {beginPageLoading}=await import('/src/loader.js');window.loaderFinishOne=beginPageLoading();window.loaderFinishTwo=beginPageLoading();});
  await loader.waitFor({state:'visible'});
  await page.evaluate(()=>window.loaderFinishOne());
  assert.equal(await loader.isVisible(),true);
  await page.evaluate(()=>window.loaderFinishTwo());
  assert.equal(await loader.isVisible(),false);
  // Smaller loaders use the same component without blocking the whole page.
  await page.evaluate(async()=>{const {startContextLoading}=await import('/src/loader.js');const target=document.createElement('div');target.id='context-test';document.querySelector('main').prepend(target);window.finishContext=startContextLoading(target,'Loading your orders...');});
  await page.locator('#context-test [role=status]').waitFor({state:'visible'});
  assert.equal(await loader.isVisible(),false);
  assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
  assert.equal(await page.locator('#context-test').getAttribute('aria-busy'),'true');
  await page.evaluate(()=>window.finishContext());
  assert.equal(await page.locator('#context-test').getAttribute('aria-busy'),null);
  // Failed requests must release the screen and leave the existing error UI usable.
  failProducts=true;
  await page.goto('http://127.0.0.1:5177/shop.html');
  await loader.waitFor({state:'hidden'});
  await page.getByRole('status').filter({hasText:'Could not load the store:'}).waitFor();
  assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
  assert.deepEqual(errors,[]);
  console.log('Loading checks passed: gated real requests, immediate dismissal, concurrent tasks, reduced motion, contextual status, failure cleanup and mobile layout.');
}finally{releaseProducts();await browser.close();await server.close();}
