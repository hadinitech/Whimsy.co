import './commerce.css';
import './badges.css';
import './site.css';
import { mountHomeProducts } from './home-products.js';
import { mountCommunityWall } from './community.js';
import { store, supabase } from './store.js';
import { finishPageLoading, beginPageLoading } from './loader.js';

const notice = document.createElement('div');
const menuButton=document.querySelector('header.site #hamburgerBtn');
const mobileMenu=document.querySelector('header.site #mobileMenu');
function closeMobileMenu(){mobileMenu?.classList.remove('open');menuButton?.setAttribute('aria-expanded','false');}
menuButton?.addEventListener('click',()=>{const open=mobileMenu.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open));});
mobileMenu?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMobileMenu));
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeMobileMenu();}});
notice.className = 'store-notice'; notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
document.body.append(notice);
let noticeTimer;
window.whimsyNotice = message => { notice.textContent = message; notice.classList.add('visible'); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => notice.classList.remove('visible'), 6000); };
for (const [label, href] of [['Account', 'account.html'], ['Cart', 'cart.html'], ['Bag', 'cart.html']]) {
  document.querySelectorAll(`button[aria-label="${label}"]`).forEach(button => {
    button.addEventListener('click', async () => {
      const finish = label === 'Account' ? beginPageLoading() : () => {};
      try { location.href = label === 'Account' ? await store.accountDestination() : href; }
      catch (error) { window.whimsyNotice(`Could not open your account: ${error.message}`); }
      finally { finish(); }
    });
    if (label !== 'Account') { const count = document.createElement('span'); count.className = 'bag-count'; count.dataset.cartCount = ''; button.append(count); }
  });
}
document.querySelectorAll('button[aria-label="Wishlist"],button[aria-label="Favourites"]').forEach(button => {
  button.setAttribute('aria-label','Favourites');
  button.addEventListener('click',()=>{location.href='shop.html?favourites=1';});
  const count=document.createElement('span');count.className='bag-count';count.dataset.favouriteCount='';button.append(count);
});
store.subscribe(() => {
  document.querySelectorAll('[data-cart-count]').forEach(el => { el.textContent = store.count; el.hidden = !store.count; });
  document.querySelectorAll('[data-favourite-count]').forEach(el => { el.textContent=store.favourites.length;el.hidden=!store.favourites.length; });
});
await store.ready;
document.querySelectorAll('a[href="index.html#signup"],a[href="#signup"]').forEach(a => { a.href = 'account.html'; a.textContent = 'YOUR WHIMSY ACCOUNT →'; });
if (location.pathname.endsWith('index.html') || location.pathname === '/') {
  const communitySection=document.querySelector('section.social');
  if(communitySection)mountCommunityWall(communitySection).catch(error=>window.whimsyNotice(error.message));
  mountHomeProducts();
}
if (!supabase) {
  const banner = document.createElement('div'); banner.className = 'preview-banner';
  banner.textContent = 'Store preview · Sample catalog · Checkout is not available yet';
  document.querySelector('header')?.after(banner);
}
if (store.error) window.whimsyNotice(`Could not load the store: ${store.error}`);
store.emit();
if (!document.body.dataset.page && !document.getElementById('grid1') && !document.getElementById('shop-app')) finishPageLoading();
