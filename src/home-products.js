import {store,escapeHTML as esc,money,safeImage} from './store.js';
import {ICONS} from './catalog.js';

function image(product){
  const url=product.image_url&&safeImage(product.image_url);
  const fallback=`<svg viewBox="0 0 100 100" aria-hidden="true">${(ICONS[product.icon]||ICONS.tote).replaceAll('{{bg}}','#fff9ee')}</svg>`;
  return `${url?`<img src="${esc(url)}" alt="${esc(product.name)}" loading="lazy" decoding="async">`:''}<span class="home-image-fallback" ${url?'hidden':''}>${fallback}</span>`;
}
export function mountHomeProducts(){
  const best=document.querySelector('#bestsellers .product-grid'),drops=document.querySelector('#drop .drop-grid');
  function render(){
    if(best)best.innerHTML=store.products.filter(p=>p.collections.includes('bestseller')).slice(0,4).map(p=>`<article class="product-card" data-product-id="${esc(p.id)}"><div class="product-thumb"><a class="home-product-image" href="product.html?id=${encodeURIComponent(p.id)}">${image(p)}</a><button type="button" class="quick-add" data-product-id="${esc(p.id)}" ${p.stock?'':'aria-disabled="true"'}>${p.stock?'ADD TO CART →':'UNAVAILABLE'}</button></div><div class="product-info"><div class="pname"><a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></div><div class="prow"><span class="price">${money(p.price_cents)}</span>${p.rating?`<span class="stars" aria-label="${p.rating} out of 5 stars">${'★'.repeat(p.rating)}</span>`:''}</div></div></article>`).join('')||'<p>Good things are on their way. Browse the shop for the latest.</p>';
    if(drops)drops.innerHTML=store.products.filter(p=>p.collections.includes('new')).slice(0,3).map(p=>`<article class="drop-card" data-product-id="${esc(p.id)}"><span class="sticker -grape">NEW</span><a class="drop-thumb home-product-image" href="product.html?id=${encodeURIComponent(p.id)}">${image(p)}</a><div class="pname"><a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></div><div class="price">${money(p.price_cents)}</div></article>`).join('')||'<p>New little things are on their way.</p>';
  }
  for(const section of [best,drops].filter(Boolean)){
    section.addEventListener('error',event=>{if(event.target.matches('img')){event.target.hidden=true;event.target.parentElement.querySelector('.home-image-fallback').hidden=false;}},true);
    section.addEventListener('click',async event=>{
      const button=event.target.closest('button.quick-add');if(!button)return;
      const product=store.products.find(p=>p.id===button.dataset.productId);
      if(!product?.stock){window.whimsyNotice('This little thing is currently unavailable.');return;}
      button.disabled=true;
      try{await store.add(product.id);window.whimsyNotice('Added to your bag.');}catch(error){window.whimsyNotice(error.message);}finally{button.disabled=false;}
    });
  }
  // This editorial feature uses the same product record as its catalogue card.
  function storyImage(){
    const image=document.querySelector('.story-art [data-product-image]');
    if(!image)return;
    const product=store.products.find(p=>p.id===image.dataset.productImage);
    const url=product?.image_url&&safeImage(product.image_url);
    if(url){image.src=url;image.alt=product.name;}
  }
  render();storyImage();store.subscribe(()=>{render();storyImage();});
}
