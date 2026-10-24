import './common.js';
import { mountAdmin } from './admin.js';
import './account.css';
import './customer.css';
import { mountCustomerDashboard, unmountCustomerDashboard } from './customer.js';
import { authView, bindPasswordVisibility } from './auth-view.js';
import { finishPageLoading, beginPageLoading } from './loader.js';
import { store, supabase, money, escapeHTML as esc, safeImage } from './store.js';
import { ICONS } from './catalog.js';

const app = document.getElementById('app');
const page = document.body.dataset.page;
let authSubmitting = false;
const button = (text, href, secondary = false) => `<a class="store-button ${secondary ? 'secondary' : ''}" href="${href}">${text}</a>`;
const result = (form, message, error = false) => { const el = form.querySelector('.form-result'); el.textContent = message; el.className = `form-result ${error ? 'store-error' : 'store-success'}`; };
const unwrap = response => { if (response.error) throw response.error; return response.data; };
const art = p => p?.image_url && safeImage(p.image_url) ? `<img src="${esc(safeImage(p.image_url))}" alt="${esc(p.name)}">` : `<svg viewBox="0 0 100 100" role="img" aria-label="${esc(p?.name || 'Whimsy tote')}">${(ICONS[p?.icon] || ICONS.tote).replaceAll('{{bg}}', '#f7b6d2')}</svg>`;
function guard() {
  if (!supabase) { app.innerHTML = `<div class="store-panel lilac"><h2>Your account is coming soon</h2><p>We're getting the store ready. You can browse the sample catalog and save a bag on this device while we finish setting up accounts.</p>${button('Explore the shop', 'shop.html')}</div>`; return false; }
  return true;
}
function requireUser() {
  if (!guard()) return false;
  if (!store.user) { app.innerHTML = `<div class="store-panel"><h2>Make yourself at home</h2><p>Sign in to continue. Your bag will be saved to your account.</p>${button('Sign in', `account.html?next=${page}`)}</div>`; return false; }
  return true;
}

function renderCart() {
  if (!store.lines.length) { app.innerHTML = `<div class="store-panel empty-bag">${art()}<h2>A little room for something fun</h2><p>Your bag is empty. Let's find your next favourite thing.</p>${button('Find your thing', 'shop.html')}</div>`; return; }
  app.innerHTML = `<div class="store-grid"><section class="store-panel" aria-label="Bag items">${store.lines.map(line => `<div class="cart-line">${art(line.product)}<div><h3>${line.product ? `<a href="product.html?id=${encodeURIComponent(line.product_id)}">${esc(line.product.name)}</a>` : 'Item no longer available'}</h3><span class="muted">${line.product ? money(line.product.price_cents) : ''} each</span><div class="quantity"><button data-quantity="${esc(line.product_id)}" data-value="${line.quantity - 1}" aria-label="Decrease quantity of ${esc(line.product?.name)}">−</button><span aria-label="Quantity">${line.quantity}</span><button data-quantity="${esc(line.product_id)}" data-value="${line.quantity + 1}" aria-label="Increase quantity of ${esc(line.product?.name)}" ${!line.product?.stock || line.quantity >= line.product?.stock_quantity ? 'disabled' : ''}>+</button><button class="text-button" style="width:auto" data-quantity="${esc(line.product_id)}" data-value="0">Remove</button></div>${!line.available ? '<p class="store-error">Please reduce the quantity or remove this unavailable item.</p>' : ''}</div><strong>${money(line.total)}</strong></div>`).join('')}</section><aside class="store-panel pink"><h2>The good stuff</h2><div class="totals-row"><span>Items (${store.count})</span><strong>${money(store.subtotal)}</strong></div><div class="totals-row"><span>Delivery</span><span>To be confirmed</span></div><div class="totals-row total"><span>Subtotal</span><span>${money(store.subtotal)}</span></div><p class="muted">Shipping and tax details will be confirmed before the store opens.</p><div class="store-alert">Checkout is not open yet. Your bag is saved${store.user ? ' to your account' : ' on this device'}.</div><div class="store-actions">${button('Checkout information', 'checkout.html')}${button('Keep browsing', 'shop.html', true)}</div>${!store.user && supabase ? '<p class="muted"><a href="account.html?next=cart">Sign in</a> to save your bag across devices.</p>' : ''}</aside></div>`;
  app.querySelectorAll('[data-quantity]').forEach(btn => btn.addEventListener('click', async () => { btn.disabled = true; try { await store.setQuantity(btn.dataset.quantity, Number(btn.dataset.value)); } catch (error) { window.whimsyNotice(error.message); btn.disabled = false; } }));
}

function authForm(mode = 'login') {
  unmountCustomerDashboard();
  document.body.classList.add('account-auth');
  app.innerHTML = authView(mode);
  bindPasswordVisibility(app);
  app.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', () => authForm(el.dataset.mode)));
  if (store.user) {
    const back = document.createElement('button');
    back.type = 'button'; back.className = 'text-button customer-back-button'; back.textContent = 'Back to dashboard';
    back.addEventListener('click', renderAccount); app.append(back);
  }
  const form = app.querySelector('form');
  form.addEventListener('submit', async event => {
    event.preventDefault(); const submit = form.querySelector('[type=submit]'); submit.disabled = true;
    const data = new FormData(form); const email = data.get('email'); const password = data.get('password');
    authSubmitting = true;
    const finish = beginPageLoading();
    try {
      const redirect = new URL('account.html', location.href).href;
      if (mode === 'signup') {
        const signup = unwrap(await supabase.auth.signUp({ email, password, options: { data: { full_name: data.get('name') }, emailRedirectTo: redirect } }));
        if (signup.session) { await store.session(signup.user); const destination=await store.accountDestination(); location.replace(destination+(new URLSearchParams(location.search).get('next')==='shares'?'#shares':'')); }
        else result(form, 'Check your email to confirm your account, then sign in.');
      }
      else if (mode === 'reset') { unwrap(await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect })); result(form, 'If an account exists for that email, a reset link is on its way.'); }
      else if (mode === 'update') { unwrap(await supabase.auth.updateUser({ password })); sessionStorage.removeItem('whimsy.passwordRecovery'); location.replace('account.html'); }
      else { const session = unwrap(await supabase.auth.signInWithPassword({ email, password })); await store.session(session.user); const destination = await store.accountDestination(); const next = new URLSearchParams(location.search).get('next'); location.href = next==='shares'?`${destination}#shares`:destination === 'admin.html' ? destination : ['cart', 'checkout', 'admin'].includes(next) ? `${next}.html` : destination; }
    } catch (error) { result(form, error.message, true); } finally { submit.disabled = false; authSubmitting = false; finish(); }
  });
}

async function renderAccount() {
  document.body.classList.remove('account-auth');
  if (!guard()) return;
  if (sessionStorage.getItem('whimsy.passwordRecovery')) { authForm('update'); return; }
  if (!store.user) { authForm(); return; }
  const requestedShares=new URLSearchParams(location.search).get('next')==='shares';
  if (await store.accountDestination() === 'admin.html') { location.replace('admin.html'+(requestedShares?'#shares':'')); return; }
  if(requestedShares&&!location.hash)history.replaceState(null,'','account.html#shares');
  await mountCustomerDashboard(app, () => authForm('reset'));
}

function renderProduct() {
  const product = store.products.find(p => p.id === new URLSearchParams(location.search).get('id'));
  if (!product) { app.innerHTML = `<div class="store-panel"><h2>That little thing isn't here.</h2><p>This product may have moved or is no longer available.</p>${button('Back to the shop', 'shop.html')}</div>`; return; }
  document.title = `${product.name} — Whimsy.co`;
  app.innerHTML = `<div class="store-grid"><div class="product-art">${art(product)}</div><section class="store-panel"><div class="eyebrow">${esc(product.category)}</div><h2>${esc(product.name)}</h2><p class="product-price">${money(product.price_cents)}</p><p>${esc(product.description || 'A little piece of personality for your everyday. Full product details will be added before the store opens.')}</p><p class="muted">${product.stock ? (supabase ? `${product.stock_quantity} available` : 'Sample product · Availability to be confirmed') : 'Currently unavailable'}</p><div class="store-actions"><button id="add-product" class="store-button" ${product.stock ? '' : 'disabled'}>Add to bag +</button>${button('View your bag', 'cart.html', true)}</div><p><a href="policies.html#shipping">Shipping &amp; returns</a></p></section></div>`;
  app.querySelector('#add-product').addEventListener('click', async event => { event.target.disabled = true; try { await store.add(product.id); window.whimsyNotice('A little more whimsy in your bag.'); } catch (error) { window.whimsyNotice(error.message); } finally { event.target.disabled = false; } });
}
function renderCheckout() {
  app.innerHTML = `<div class="store-grid"><section class="store-panel lilac"><h2>We're getting the good things ready.</h2><p>Checkout is not open yet. Payment, shipping and tax details are still being finalised.</p><p>Your bag is saved${store.user ? ' to your account' : ' on this device'}. No order has been placed and no payment will be taken.</p><div class="store-actions"><button class="store-button" disabled>Checkout unavailable</button>${button('Back to your bag', 'cart.html', true)}</div>${supabase && !store.user ? '<p><a href="account.html?next=checkout">Sign in</a> to save your bag across devices.</p>' : ''}</section><aside class="store-panel"><h2>Your bag</h2>${store.lines.map(line => `<div class="totals-row"><span>${esc(line.product?.name || 'Unavailable item')} × ${line.quantity}</span><strong>${money(line.total)}</strong></div>`).join('')}<div class="totals-row total"><span>Subtotal</span><span>${money(store.subtotal)}</span></div><p class="muted">Delivery and applicable tax: to be confirmed.</p></aside></div>`;
}
function renderPolicies() {
  app.innerHTML = `<div class="store-panel"><section id="shipping" class="policy-section"><h2>Shipping</h2><p>We haven't opened checkout yet. Delivery areas, shipping rates and delivery estimates will be published here before we start accepting orders.</p></section><section id="returns" class="policy-section"><h2>Returns</h2><p>Our returns process and full store terms will be published before checkout opens. For product questions, please <a href="contact.html">contact us</a>.</p></section><section id="privacy" class="policy-section"><h2>Your details</h2><p>When accounts are enabled, your email is used to sign you in. Your account keeps your name, email, bag and order history. Delivery details will be collected at checkout when ordering opens.</p><p>Before signing in, your bag is stored in this browser. Signing in saves it to your account. Authentication uses browser storage to keep you signed in. Signing out removes account details from the page.</p><p>We use Supabase to provide accounts and store data. We do not collect payment details while checkout is disabled. A complete privacy notice with business contact and retention details will be published before launch.</p></section><section class="policy-section"><h2>Store status</h2><p>This is a store preview. Catalog prices, imagery and product descriptions are being prepared for launch. You cannot place an order yet.</p></section></div>`;
}

async function renderAdmin() {
  if (!requireUser()) return;
  if (!unwrap(await supabase.rpc('is_store_admin'))) { app.innerHTML = '<div class="store-panel"><h2>This corner is for the store team.</h2><p>Your account does not have administrator access.</p></div>'; return; }
  await mountAdmin(app);
}

await store.ready;
window.addEventListener('whimsy:recovery', () => { if (page === 'account') authForm('update'); });
async function render() {
  try { await ({ cart: renderCart, account: renderAccount, product: renderProduct, checkout: renderCheckout, admin: renderAdmin, policies: renderPolicies }[page])(); }
  catch (error) { app.innerHTML = `<div class="store-panel"><h2>We couldn't load this page.</h2><p class="store-error">${esc(error.message)}</p><button class="store-button" id="retry">Try again</button></div>`; app.querySelector('#retry').addEventListener('click', render); }
}
try { await render(); } finally { finishPageLoading(); }
if (['cart', 'checkout'].includes(page)) store.subscribe(render);
if (['account', 'admin'].includes(page)) {
  let renderedUser = store.user?.id;
  store.subscribe(() => {
    if (renderedUser !== store.user?.id) { renderedUser = store.user?.id; if (!authSubmitting) render(); }
  });
}
