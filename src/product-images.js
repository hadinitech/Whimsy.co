import { supabase } from './store.js';

export function productImageExtension(file){
  const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file?.type];
  if(!extension||!file.size||file.size>5242880)throw new Error('Choose a JPG, PNG or WebP image up to 5 MB.');
  return extension;
}
export async function uploadProductImage(id,file){
  const extension=productImageExtension(file);
  if(!/^p\d+$/.test(id))throw new Error('Invalid product. Please reopen the product editor.');
  const path=`${id}/${crypto.randomUUID()}.${extension}`;
  const result=await supabase.storage.from('product-images').upload(path,file,{contentType:file.type,upsert:false});
  if(result.error)throw result.error;
  return {path,url:supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl};
}
export async function discardUnusedProductImage(image){
  // A lost save response may still have committed. Never remove a referenced image.
  const references=await supabase.from('products').select('id').eq('image_url',image.url).limit(1);
  if(!references.error&&!references.data.length)await supabase.storage.from('product-images').remove([image.path]);
}
