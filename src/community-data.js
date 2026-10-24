import { store, supabase } from './store.js';
const columns='id,kind,display_name,caption,image_path,status,created_at';
export const shareKinds={photo:'Photo',fit:'Outfit',review:'Review',haul:'Pin haul'};
const checked=result=>{if(result.error)throw result.error;return result.data;};
const bucket=()=>supabase.storage.from('community');
export async function loadShares(scope='public',page=0){
  if(!supabase)return {rows:[],more:false};
  let query=supabase.from('community_shares').select(columns).order('created_at',{ascending:false}).order('id',{ascending:false});
  if(scope==='public')query=query.eq('status','approved');
  if(scope==='mine')query=query.eq('user_id',store.user.id);
  const size=scope==='public'?4:12;
  const data=checked(await query.range(page*size,page*size+size));
  const rows=await Promise.all(data.slice(0,size).map(async row=>{
    if(!row.image_path)return row;
    const result=await bucket().createSignedUrl(row.image_path,120);
    return {...row,image_url:result.data?.signedUrl||'',image_error:!!result.error};
  }));
  return {rows,more:data.length>size};
}
export async function submitShare(form){
  if(!supabase||!store.user)throw new Error('Please sign in to share your whimsy.');
  const owner=store.user.id,id=crypto.randomUUID(),file=form.get('photo');
  const kind=form.get('kind'),caption=String(form.get('caption')||'').trim(),display_name=String(form.get('display_name')||'').trim();
  if(!shareKinds[kind]||!caption||caption.length>1000||!display_name||display_name.length>80)throw new Error('Add your display name and a caption of up to 1,000 characters.');
  if(form.get('consent')!=='on')throw new Error('Please confirm permission to publish your submission.');
  let image_path=null;
  if(file?.size){
    const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
    if(!extension||file.size>5242880)throw new Error('Choose a JPG, PNG or WebP image up to 5 MB.');
    image_path=`${owner}/${id}.${extension}`;
    checked(await bucket().upload(image_path,file,{contentType:file.type,upsert:false}));
  }else if(kind!=='review')throw new Error('Choose a photo for this submission.');
  try{
    if(store.user?.id!==owner)throw new Error('Your account changed. Please sign in and try again.');
    return checked(await supabase.from('community_shares').insert({id,user_id:owner,kind,display_name,caption,image_path}).select(columns).single());
  }catch(error){if(image_path)await bucket().remove([image_path]);throw error;}
}
export async function moderateShare(id,status){
  if(!['approved','rejected','pending'].includes(status))throw new Error('Choose a valid review status.');
  const rows=checked(await supabase.from('community_shares').update({status}).eq('id',id).select('id'));
  if(!rows.length)throw new Error('This submission could not be updated. Refresh and try again.');
}
export async function removeShare(row){
  if(row.image_path)checked(await bucket().remove([row.image_path]));
  const rows=checked(await supabase.from('community_shares').delete().eq('id',row.id).select('id'));
  if(!rows.length)throw new Error('This submission could not be removed. Refresh and try again.');
}
