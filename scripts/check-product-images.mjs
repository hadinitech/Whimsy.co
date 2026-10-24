// Read-only verification of the completed image import against the built site.
import {readFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {loadEnv,preview} from 'vite';
import {chromium} from '@playwright/test';
const manifest=JSON.parse(readFileSync('supabase/data/product-image-import-2026-10-23.json','utf8'));
const env=loadEnv('production',process.cwd(),'VITE_');
const api=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const response=await api.from('products').select('*');assert.ifError(response.error);
const products=response.data;assert.equal(products.length,24,'No duplicate products created');
for(const entry of manifest){
  const product=products.find(p=>p.id===entry.id);assert.equal(product.name,entry.name);assert.equal(product.image_url,entry.image_url);
  const image=await fetch(product.image_url);assert.equal(image.status,200);
  assert.equal(createHash('sha256').update(Buffer.from(await image.arrayBuffer())).digest('hex'),entry.sha256,'Served image matches supplied bytes');
}
const server=await preview({preview:{host:'127.0.0.1',port:5186,strictPort:true}});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const base='http://127.0.0.1:5186';
async function verifyImage(image,product){
  await image.scrollIntoViewIfNeeded();
  await image.evaluate(image=>image.decode());
  assert.equal(await image.getAttribute('src'),product.image_url);
  assert.ok(await image.evaluate(image=>image.naturalWidth>0));
}
try{
  await page.goto(`${base}/index.html`);await page.locator('#whimsy-page-loader').waitFor({state:'hidden'});
  for(const selector of ['#bestsellers .product-card','#drop .drop-card']){
    const cards=page.locator(selector);await cards.first().waitFor();
    for(const card of await cards.all()){
      const id=await card.getAttribute('data-product-id'),product=products.find(p=>p.id===id);
      assert.equal(await card.locator('.pname').innerText(),product.name);
      if(product.image_url)await verifyImage(card.locator('img'),product);
    }
  }
  await verifyImage(page.locator('.story-art img'),products.find(p=>p.id==='p17'));
  mkdirSync('artifacts',{recursive:true});
  await page.locator('#bestsellers').screenshot({path:'artifacts/imported-bestsellers.png'});
  await page.locator('#drop').screenshot({path:'artifacts/imported-new-drops.png'});
  for(const collection of ['', '?collection=bestseller','?collection=new']){
    await page.goto(`${base}/shop.html${collection}`);await page.locator('#whimsy-page-loader').waitFor({state:'hidden'});
    for(const entry of manifest){
      const product=products.find(p=>p.id===entry.id),filter=collection.includes('bestseller')?'bestseller':collection.includes('new')?'new':null;
      if(filter&&!product.collections.includes(filter))continue;
      const card=page.locator(`.catalogue-card[data-id="${entry.id}"]`);await verifyImage(card.locator('img'),product);
      assert.equal(await card.locator('.pname').innerText(),product.name);
    }
  }
  for(const entry of manifest){await page.goto(`${base}/product.html?id=${entry.id}`);await page.locator('#whimsy-page-loader').waitFor({state:'hidden'});await verifyImage(page.locator('.product-art img'),products.find(p=>p.id===entry.id));}
  await page.goto(`${base}/index.html`);await page.locator('#whimsy-page-loader').waitFor({state:'hidden'});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await verifyImage(page.locator('#bestsellers [data-product-id="p1"] img'),products.find(p=>p.id==='p1'));
  assert.deepEqual(errors,[]);
  console.log('Live image verification passed: all 7 originals match byte-for-byte, names and image URLs saved on existing records; landing/Currently Obsessed, New Drops, shop collections, product details and mobile checked. Catalogue remains 24 products.');
}finally{await browser.close();await server.httpServer.close();}
