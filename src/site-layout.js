// Rendered into every public HTML page by Vite, before any browser JavaScript runs.
const icon=path=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const account=icon('<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/>');
const heart=icon('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>');
const bag=icon('<path d="M5 7h14l1 14H4L5 7Z"/><path d="M9 10V5a3 3 0 0 1 6 0v5"/>');
const logo='<a href="index.html" class="logo">whimsy<span>.</span>co</a>';
export function siteHeader(page,mainId='main-content'){
  const links=[['shop','Shop'],['about','About'],['contact','Contact']].map(([id,label])=>`<a href="${id}.html" ${page===id||page==='product'&&id==='shop'?'class="active" aria-current="page"':''}>${label}</a>`);
  return `<a class="site-skip" href="#${mainId}">Skip to content</a><header class="site"><nav class="main" aria-label="Main navigation">${logo}<ul class="nav-links">${links.map(link=>`<li>${link}</li>`).join('')}</ul><div class="nav-icons"><button type="button" aria-label="Account">${account}</button><button type="button" aria-label="Favourites">${heart}</button><button type="button" aria-label="Cart" ${page==='cart'?'aria-current="page"':''}>${bag}</button><button type="button" class="hamburger" id="hamburgerBtn" aria-label="Menu" aria-controls="mobileMenu" aria-expanded="false"><span></span><span></span><span></span></button></div></nav><nav class="mobile-menu" id="mobileMenu" aria-label="Mobile navigation">${links.join('')}</nav></header>`;
}
export function siteFooter(){
  const group=(title,links)=>`<div class="footer-col"><h4>${title}</h4>${links.map(([href,label])=>`<a href="${href}">${label}</a>`).join('')}</div>`;
  return `<footer class="site"><div class="wrap"><div class="footer-grid"><div class="footer-brand">${logo}<p>get your whimsy back.</p></div>${group('Shop',[['shop.html?category=totes','Totes'],['shop.html?category=pins','Pins'],['shop.html?collection=new','New Drops'],['shop.html?collection=bestseller','Bestsellers']])}${group('Help',[['policies.html','Store information'],['policies.html#shipping','Shipping'],['policies.html#returns','Returns'],['policies.html#privacy','Privacy'],['contact.html','Contact']])}${group('Brand',[['about.html','About'],['index.html#story','Our Story']])}${group('Your corner',[['account.html','My account'],['cart.html','My bag'],['shop.html?favourites=1','Favourites'],['account.html?next=shares','My shares']])}</div><div class="footer-bottom"><span>© ${new Date().getFullYear()} whimsy co. all rights reserved.</span><span>Designed &amp; developed by <a href="https://HadiniHoldings.co.za">Hadini Holdings</a></span></div></div></footer>`;
}
export function applySiteLayout(html,filename){
  const page=filename.replaceAll('\\','/').split('/').pop()?.replace(/\.html$/,'');
  if(!['index','shop','about','contact','cart','product','checkout','policies'].includes(page))return html;
  let mainId=html.match(/<main\b[^>]*\bid="([^"]+)"/)?.[1];
  if(!mainId){mainId='main-content';html=html.replace(/<main\b/,'<main id="main-content"');}
  return html.replace('<!-- WHIMSY_HEADER -->',siteHeader(page,mainId)).replace('<!-- WHIMSY_FOOTER -->',siteFooter());
}
