// One-off, auditable import. No credentials are written to disk or printed.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {loadEnv} from 'vite';
import {once} from 'node:events';
const env=loadEnv('development',process.cwd(),'VITE_');
const api=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const source='C:/Users/Tsumb/Documents/AAA/';
const targets=[['p1','Anxiety Hearts Canvas Tote'],['p2','Certified Feral Cat Pin'],['p4','Joyful Enamel Pin Duo'],['p5','Gremlin Mode Cat Tote Bag'],['p6','Feral Little Guy Enamel Pin'],['p7','Chaos Goblin Trash Can Charm'],['p17','A Little More Whimsy Please']];
const check=result=>{if(result.error)throw result.error;return result.data;};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const products=check(await api.from('products').select('id,name,image_url'));
mkdirSync('supabase/data',{recursive:true});
const reportPath='supabase/data/product-image-import-2026-10-23.json';
if(existsSync(reportPath))throw new Error('An import manifest already exists. Inspect it before running this import again.');
const manifest=targets.map(([id,name])=>{
  const product=products.find(p=>p.id===id);if(!product)throw new Error(`Missing existing product ${id}`);
  const file=`${name}.png`,bytes=readFileSync(source+file);
  return {id,name,file,previous_name:product.name,previous_image_url:product.image_url,path:`${id}/${randomUUID()}.png`,sha256:digest(bytes),uploaded:false};
});
writeFileSync(reportPath,JSON.stringify(manifest,null,2)+'\n');
const signed=check(await api.auth.signUp({email:`whimsy-image-import-${randomUUID()}@example.com`,password:`Import-${randomUUID()}-Aa9!`}));
if(!signed.session)throw new Error('A temporary authenticated import session is required.');
console.log(JSON.stringify({import_user:signed.user.id,paths:manifest.map(item=>item.path)}));
console.log('READY_FOR_SCOPED_UPLOAD_ACCESS');
await once(process.stdin,'data');
try{
  for(const item of manifest){
    const bytes=readFileSync(source+item.file);if(digest(bytes)!==item.sha256)throw new Error('Source image changed during import');
    check(await api.storage.from('product-images').upload(item.path,bytes,{contentType:'image/png',upsert:false,cacheControl:'3600'}));
    item.image_url=api.storage.from('product-images').getPublicUrl(item.path).data.publicUrl;
    const served=await fetch(item.image_url);if(!served.ok)throw new Error(`Image retrieval failed for ${item.id}`);
    if(digest(Buffer.from(await served.arrayBuffer()))!==item.sha256)throw new Error(`Image bytes differ for ${item.id}`);
    item.uploaded=true;writeFileSync(reportPath,JSON.stringify(manifest,null,2)+'\n');console.log(`Uploaded and byte-verified: ${item.id} ${item.name}`);
  }
}finally{await api.auth.signOut();}
console.log('UPLOAD_IMPORT_COMPLETE');
process.exit(0);
