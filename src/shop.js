import './common.js';
import './shop.css';
import { store, escapeHTML as esc } from './store.js';
import { finishPageLoading } from './loader.js';
import { shopLayout,productCard,heroArt,promos } from './shop-views.js';

const root=document.getElementById('shop-app');
root.innerHTML=shopLayout();
const params=new URLSearchParams(location.search);
const state={category:params.get('category')||params.get('collection')||'all',search:'',stock:false,favourites:params.has('favourites'),price:'all',sort:'featured',mood:null};
const labels={totes:'Totes',pins:'Pins',keychains:'Keychains',new:'New Drops',bestseller:'Bestsellers'};
const kind=p=>p.icon==='keychain'?'keychains':p.category;
const categoryMatches=(p,category)=>category==='all'||(['new','bestseller'].includes(category)?p.collections.includes(category):category===kind(p));
let products=[];
function categories(){
  const values=['all',...new Set(products.map(kind)),...['new','bestseller'].filter(c=>products.some(p=>p.collections.includes(c)))];
  if(!values.includes(state.category))state.category='all';
  root.querySelector('#catTabs').innerHTML=values.map(value=>`<button type="button" class="cat-tab ${state.category===value?'active':''}" data-cat="${esc(value)}" aria-pressed="${state.category===value}">${value==='all'?'All':esc(labels[value]||value)}</button>`).join('');
}
function matches(p){
  if(!categoryMatches(p,state.category))return false;
  if(state.search && !`${p.name} ${p.description||''}`.toLowerCase().includes(state.search.toLowerCase()))return false;
  if(state.stock&&p.stock_quantity<=0)return false;
  if(state.favourites&&!store.favourites.includes(p.id))return false;
  if(state.mood&&p.mood!==state.mood)return false;
  if(state.price==='under150'&&p.price_cents>=15000)return false;
  if(state.price==='150to400'&&(p.price_cents<15000||p.price_cents>40000))return false;
  if(state.price==='over400'&&p.price_cents<=40000)return false;
  return true;
}
function render(){
  products=store.products;
  categories();
  root.querySelector('#catalogue-count').textContent=products.length;
  const filtered=products.filter(matches).sort((a,b)=>({newest:()=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)||b.order-a.order,lowhigh:()=>a.price_cents-b.price_cents,highlow:()=>b.price_cents-a.price_cents,name:()=>a.name.localeCompare(b.name),featured:()=>a.order-b.order}[state.sort])()||a.id.localeCompare(b.id));
  root.querySelector('#grid1').innerHTML=filtered.map(p=>productCard(p,store.favourites)).join('');
  root.querySelector('#resultCount').textContent=`${filtered.length} ${filtered.length===1?'thing':'things'}${state.favourites?' you love':''}`;
  const empty=root.querySelector('#emptyState');empty.hidden=filtered.length>0;
  if(!filtered.length)empty.innerHTML=`<span aria-hidden="true">✧</span><h2>${store.error?'The chaos is taking a moment.':products.length?'No chaos found here.':'Good things are on their way.'}</h2><p>${store.error?esc(store.error):products.length?'Try a different filter or find a new favourite.':'There are no visible products in the shop yet. Check back soon.'}</p>${products.length?'<button class="catalogue-button" data-reset>View all products</button>':store.error?'<button class="catalogue-button" data-retry>Try again</button>':''}`;
  root.querySelector('#catalogue-promos').innerHTML=promos(products,state.mood);
  const count=Number(state.stock)+Number(state.favourites)+Number(state.price!=='all')+Number(Boolean(state.mood));
  const badge=root.querySelector('#active-filter-count');badge.hidden=!count;badge.textContent=count;
  root.querySelector('#filter-stock').checked=state.stock;root.querySelector('#filter-favourites').checked=state.favourites;root.querySelector('#filter-price').value=state.price;
  const mood=root.querySelector('#active-mood');mood.hidden=!state.mood;mood.textContent=state.mood?`Mood: ${state.mood}`:'';
}
function reset(){state.category='all';state.search='';state.stock=false;state.favourites=false;state.price='all';state.mood=null;root.querySelector('[type=search]').value='';render();}
root.addEventListener('input',event=>{if(event.target.matches('[type=search]')){state.search=event.target.value;render();}});
root.addEventListener('change',event=>{
  if(event.target.id==='filter-stock')state.stock=event.target.checked;
  else if(event.target.id==='filter-favourites')state.favourites=event.target.checked;
  else if(event.target.id==='filter-price')state.price=event.target.value;
  else if(event.target.matches('.catalogue-sort select'))state.sort=event.target.value;
  else return;
  render();
});
root.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  try{
    if(button.dataset.favourite){button.disabled=true;await store.toggleFavourite(button.dataset.favourite);}
    else if(button.dataset.product){button.disabled=true;await store.add(button.dataset.product);window.whimsyNotice('Added to your bag.');}
    else if(button.dataset.cat){state.category=button.dataset.cat;render();}
    else if(button.dataset.promoCategory){state.category=button.dataset.promoCategory;state.mood=null;state.search='';root.querySelector('[type=search]').value='';render();root.querySelector('#catTabs').scrollIntoView({block:'start',behavior:'smooth'});}
    else if(button.dataset.mood){state.mood=state.mood===button.dataset.mood?null:button.dataset.mood;render();root.querySelector('#catTabs').scrollIntoView({block:'start',behavior:'smooth'});}
    else if(button.id==='filterBtn'){const panel=root.querySelector('#catalogue-filters');panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));}
    else if(button.id==='clearFilters'||button.hasAttribute('data-reset'))reset();
    else if(button.hasAttribute('data-retry')){store.error='';await store.refresh();render();}
  }catch(error){window.whimsyNotice(error.message);}finally{button.disabled=false;}
});
root.addEventListener('error',event=>{if(event.target.matches('img')){event.target.hidden=true;event.target.parentElement.querySelector('.catalogue-fallback-slot').hidden=false;}},true);
await store.ready;
try{render();root.querySelector('#catalogue-hero-art').innerHTML=heroArt(products);store.subscribe(render);}finally{finishPageLoading();}
if(params.has('search')){root.querySelector('.catalogue-search').classList.add('is-open');root.querySelector('[type=search]').focus();}
