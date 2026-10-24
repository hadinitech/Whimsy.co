import './community.css';
import { store, escapeHTML as esc } from './store.js';
import { shareKinds,loadShares,submitShare,moderateShare,removeShare } from './community-data.js';

function composer(kind='photo'){
  if(!store.user)return '<p>Sign in to share a photo, your outfit, a review or your latest pin haul.</p><a class="store-button" href="account.html?next=shares">Sign in to share</a>';
  return `<form class="community-form"><label>What are you sharing?<select name="kind">${Object.entries(shareKinds).map(([key,label])=>`<option value="${key}" ${key===kind?'selected':''}>${label}</option>`).join('')}</select></label><label>Public display name<input name="display_name" maxlength="80" required autocomplete="nickname" value="${esc(store.profile?.full_name||'')}"></label><label>Caption or review<textarea name="caption" maxlength="1000" rows="3" required placeholder="Tell us about your little bit of chaos…"></textarea></label><label>Photo <small>(optional for a review)</small><input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><p class="community-help">JPG, PNG or WebP, up to 5 MB. Your email and account details stay private.</p><label class="community-consent"><input type="checkbox" name="consent" required> I own this content, have permission from anyone pictured, and agree that Whimsy may display it on the public wall after review.</label><button class="store-button" type="submit">Submit for review →</button><p class="community-result" role="status" aria-live="polite"></p></form>`;
}
function card(row,scope){
  return `<article class="community-card" data-share-id="${esc(row.id)}">${row.image_url?`<img src="${esc(row.image_url)}" alt="${esc(shareKinds[row.kind])} shared by ${esc(row.display_name)}" loading="lazy">`:row.image_path?'<p class="community-image-error">Photo unavailable. Refresh to try again.</p>':''}<div class="community-card-copy"><small>${esc(shareKinds[row.kind])} · ${new Date(row.created_at).toLocaleDateString('en-ZA')}</small><p class="community-caption">${esc(row.caption)}</p><strong>${esc(row.display_name)}</strong>${scope!=='public'?`<p><span class="pill">${{pending:'Awaiting review',approved:'Published',rejected:'Not published'}[row.status]}</span></p><div class="community-actions">${scope==='admin'?`<button type="button" data-moderate="approved" ${row.status==='approved'?'disabled':''}>Publish</button><button type="button" data-moderate="rejected" ${row.status==='rejected'?'disabled':''}>${row.status==='approved'?'Unpublish':'Decline'}</button>`:''}<button type="button" data-remove-share>Delete</button></div>`:''}</div></article>`;
}
function bindComposer(container,onSaved){
  container.addEventListener('submit',async event=>{
    if(!event.target.matches('.community-form'))return;
    event.preventDefault();const form=event.target,button=form.querySelector('[type=submit]'),result=form.querySelector('.community-result');
    if(button.disabled)return;
    const data=new FormData(form);button.disabled=true;result.textContent='Saving your submission…';
    try{await submitShare(data);form.reset();result.textContent='Saved! Your submission is awaiting review. Find it under My shares on your dashboard.';await onSaved?.();}
    catch(error){result.textContent=error.message;}
    finally{button.disabled=false;}
  });
}
function bindShareImages(container){
  container.addEventListener('error',event=>{if(event.target.matches('.community-card img'))event.target.replaceWith(Object.assign(document.createElement('p'),{textContent:'Photo unavailable. Refresh to try again.',className:'community-image-error'}));},true);
}
export async function mountShareDashboard(root,scope){
  let page=0,rows=[],more=false,request=0;
  root.innerHTML=`<section class="admin-panel"><div class="admin-section-top"><div><h2>${scope==='admin'?'Community shares':'My shares'}</h2><p>${scope==='admin'?'Review what customers have shared. Only published submissions appear on the public wall.':'Your photos, outfits, reviews and pin hauls. Submissions appear on the public wall after review.'}</p></div><button type="button" class="admin-button secondary" data-refresh-shares>Refresh</button></div>${scope==='mine'?`<details class="community-compose"><summary>Share something new</summary>${composer()}</details>`:''}<div class="community-list" aria-live="polite"></div><div class="community-pagination"></div></section>`;
  const list=root.querySelector('.community-list'),pagination=root.querySelector('.community-pagination');
  async function refresh(){
    const currentRequest=++request;
    list.innerHTML='<p role="status">Loading community shares…</p>';
    try{
      const data=await loadShares(scope,page);if(!root.isConnected||currentRequest!==request)return;
      rows=data.rows;more=data.more;list.innerHTML=rows.length?rows.map(row=>card(row,scope)).join(''):'<p class="community-empty">No submissions here yet.</p>';
      pagination.innerHTML=`${page?'<button type="button" data-share-page="prev">Previous</button>':''}${more?'<button type="button" data-share-page="next">Next</button>':''}`;
    }catch(error){if(!root.isConnected||currentRequest!==request)return;list.innerHTML=`<p role="alert">Could not load submissions: ${esc(error.message)}. Use Refresh to try again.</p>`;pagination.innerHTML='';}
  }
  bindComposer(root,()=>{page=0;return refresh();});
  root.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-refresh-shares'))return refresh();
    if(button.dataset.sharePage){page+=button.dataset.sharePage==='next'?1:-1;return refresh();}
    const row=rows.find(row=>row.id===button.closest('[data-share-id]')?.dataset.shareId);if(!row)return;
    if(button.hasAttribute('data-remove-share')&&!window.confirm('Delete this submission and its photo?'))return;
    button.disabled=true;
    try{
      if(button.dataset.moderate)await moderateShare(row.id,button.dataset.moderate);
      else if(button.hasAttribute('data-remove-share'))await removeShare(row);
      else return;
      await refresh();
    }catch(error){window.whimsyNotice(error.message);button.disabled=false;}
  });
  bindShareImages(root);
  await refresh();
}
export async function mountCommunityWall(section){
  const grid=section.querySelector('.social-grid'),cta=section.querySelector('.social-cta');
  bindShareImages(grid);
  const labels={photo:'your photo here',fit:'your fit here',review:'your review here',haul:'your pin haul here'};
  const dialog=document.createElement('dialog');dialog.className='community-dialog';dialog.setAttribute('aria-labelledby','community-title');document.body.append(dialog);
  function open(kind='photo'){
    dialog.innerHTML=`<div class="community-dialog-top"><h2 id="community-title">Caught in the wild</h2><button type="button" data-close-community aria-label="Close share form">×</button></div>${composer(kind)}`;
    dialog.querySelector('[data-close-community]').onclick=()=>dialog.close();dialog.showModal();
  }
  // A single delegated submit listener survives opening and closing the dialog.
  bindComposer(dialog);
  cta.innerHTML='<button type="button" class="btn btn-primary" data-open-community="photo">SHARE YOUR WHIMSY →</button><p><a href="account.html?next=shares">View my shares</a></p>';
  section.addEventListener('click',event=>{const button=event.target.closest('[data-open-community]');if(button)open(button.dataset.openCommunity);});
  try{
    const data=await loadShares();
    grid.innerHTML=data.rows.length?data.rows.map(row=>card(row,'public')).join(''):Object.entries(labels).map(([kind,label])=>`<button type="button" class="social-tile" data-open-community="${kind}"><span aria-hidden="true">${{photo:'◎',fit:'+',review:'○',haul:'♡'}[kind]}</span>${label}</button>`).join('');
  }catch(error){grid.innerHTML=`<p role="alert">The wall could not load. ${esc(error.message)} <button type="button" data-open-community="photo">Share your whimsy</button></p>`;}
}
