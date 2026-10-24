// Browser integration checks with simulated Supabase HTTP responses.
// SQL authorization is tested separately against PostgreSQL in npm test.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { SAMPLE_PRODUCTS } from '../src/catalog.js';
import { mkdirSync } from 'node:fs';

const origin = 'https://whimsy-test.supabase.co';
const server = await createServer({ server: { host: '127.0.0.1', port: 5174 }, define: {
  'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(origin),
  'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_browser_test_only')
} });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'customer@example.test', email_confirmed_at: new Date().toISOString(), user_metadata: { full_name:'Test Customer' }, app_metadata: {}, identities: [], created_at: new Date().toISOString() };
const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600, role: 'authenticated' })).toString('base64url')}.test-signature`;
let profile = null, cart = [], mergeCalls = 0, savedProfile = null, autoConfirmSignup = false, isAdmin = false;
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.setDefaultTimeout(10000);
await page.route(`${origin}/**`, async route => {
  const req = route.request(), url = new URL(req.url());
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*' } });
  if (req.method() === 'OPTIONS') return json({});
  const body = req.postData() ? JSON.parse(req.postData()) : {};
  if (url.pathname === '/auth/v1/token') return json({ access_token:token, refresh_token:'test-refresh-token', token_type:'bearer', expires_in:3600, user });
  if (url.pathname === '/auth/v1/user') return json(user);
  if (url.pathname === '/auth/v1/signup') return json(autoConfirmSignup ? { access_token:token, refresh_token:'test-refresh-token', token_type:'bearer', expires_in:3600, user } : { user, session: null });
  if (['/auth/v1/recover','/auth/v1/logout'].includes(url.pathname)) return json({});
  if (url.pathname === '/rest/v1/products') return json(SAMPLE_PRODUCTS.map(p => ({...p, price_cents:p.price*100, stock_quantity:p.stock?5:0, sort_order:p.order, active:true})));
  if (url.pathname === '/rest/v1/store_settings') return json({id:1,checkout_enabled:false});
  if (url.pathname === '/rest/v1/profiles') {
    if (req.method() === 'POST') { savedProfile = body; profile = body; return json(null,201); }
    return json(profile);
  }
  if (url.pathname === '/rest/v1/cart_items') return json(cart);
  if (url.pathname === '/rest/v1/favourites') return json([]);
  if (url.pathname === '/rest/v1/community_shares') return json([]);
  if (url.pathname === '/rest/v1/orders') return json([]);
  if (url.pathname === '/rest/v1/rpc/is_store_admin') return json(isAdmin);
  if (url.pathname === '/rest/v1/rpc/merge_guest_cart') { mergeCalls++; cart = body.items; return json(null); }
  if (url.pathname === '/rest/v1/rpc/set_cart_quantity') { cart = body.amount ? [{product_id:body.product,quantity:body.amount}] : []; return json(null); }
  console.error('Unhandled mock request',req.method(),url.pathname);
  return json({message:'Unhandled test request'},500);
});
try {
  await page.goto('http://127.0.0.1:5174/account.html');
  await page.getByRole('heading', {name:'Your little corner',exact:true}).waitFor();
  assert.equal(await page.locator('header, footer, nav, [role="tablist"]').count(),0);
  assert.equal(await page.getByLabel('Email',{exact:true}).inputValue(),'');
  assert.equal(await page.getByLabel('Password',{exact:true}).inputValue(),'');
  mkdirSync('artifacts', { recursive:true });
  await page.setViewportSize({width:1074,height:660});
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path:'artifacts/login-desktop.png',fullPage:true});
  for (const width of [768,650,390,320]) {
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`Account should fit at ${width}px`);
    const left = await page.locator('.auth-login').boundingBox();
    const right = await page.locator('.auth-benefits').boundingBox();
    if (width <= 800) assert.ok(right.y >= left.y + left.height,'Login card precedes benefits on mobile');
    if (width === 390) await page.screenshot({path:'artifacts/login-mobile.png',fullPage:true});
  }
  await page.setViewportSize({width:1074,height:660});
  for (const [width,height] of [[1074,660],[1440,900],[768,844],[390,844],[390,664],[320,568],[844,390]]) {
    await page.setViewportSize({width,height});
    for (const mode of ['login','signup','reset']) {
      if (mode === 'signup') await page.getByRole('button',{name:'Create an account',exact:true}).click();
      if (mode === 'reset') {
        await page.getByRole('button',{name:'Back to sign in',exact:true}).click();
        await page.getByRole('button',{name:'Forgot password?'}).click();
      }
      const fit = await page.evaluate(() => {
        const card = document.querySelector('.auth-login');
        return { pageFits:document.documentElement.scrollHeight <= innerHeight, cardFits:card.scrollHeight <= card.clientHeight + 1,
          controlsFit:[...document.querySelectorAll('#app input,#app button,#app a')].every(el => { const r=el.getBoundingClientRect();return r.bottom <= innerHeight && r.top>=0 && r.right<=innerWidth && r.left>=0; }) };
      });
      assert.deepEqual(fit,{pageFits:true,cardFits:true,controlsFit:true},`${mode} fits ${width}×${height}`);
      if (width===390 && height===844) await page.screenshot({path:`artifacts/${mode}-viewport-mobile.png`});
      if (mode==='reset') await page.getByRole('button',{name:'Back to sign in',exact:true}).click();
    }
  }
  await page.setViewportSize({width:1074,height:660});
  await page.getByRole('button', { name:'Create an account', exact:true }).click();
  await page.getByLabel('Your name').fill('Test Customer');
  await page.getByLabel('Email', {exact:true}).fill(user.email);
  await page.getByLabel('Password', {exact:true}).fill('password-for-test');
  await page.getByRole('button', {name:'Create account',exact:true}).click();
  await page.getByText('Check your email to confirm your account, then sign in.').waitFor();
  await page.getByRole('button', {name:'Back to sign in',exact:true}).click();
  await page.getByRole('button', {name:'Forgot password?'}).click();
  await page.getByLabel('Email',{exact:true}).fill(user.email);
  await page.getByRole('button',{name:'Send reset link'}).click();
  await page.getByText('If an account exists for that email, a reset link is on its way.').waitFor();
  await page.evaluate(() => localStorage.setItem('whimsy.cart.v1',JSON.stringify([{product_id:'p1',quantity:2}])));
  await page.getByRole('button', {name:'Back to sign in',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill(user.email);
  await page.getByLabel('Password',{exact:true}).fill('password-for-test');
  await Promise.all([page.waitForNavigation(), page.getByRole('button',{name:'Sign in',exact:true}).click()]);
  await page.getByRole('heading',{name:'Welcome back, Test'}).waitFor();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('button',{name:'Create an account',exact:true}).click();
  autoConfirmSignup = true;
  await page.getByLabel('Your name').fill('Test Customer');
  await page.getByLabel('Email',{exact:true}).fill(user.email);
  await page.getByLabel('Password',{exact:true}).fill('password-for-test');
  await Promise.all([page.waitForNavigation(), page.getByRole('button',{name:'Create account',exact:true}).click()]);
  await page.getByRole('heading',{name:'Welcome back, Test'}).waitFor();
  autoConfirmSignup = false;
  assert.equal(await page.locator('#profile-form,input[autocomplete^="address"],input[autocomplete="postal-code"]').count(),0);
  assert.equal(savedProfile,null,'Dashboard does not write profile or address details');
  await page.locator('.admin-sidebar [data-customer-section="orders"]').click();
  await page.getByRole('heading',{name:'My orders',exact:true}).waitFor();
  await page.getByText('Your first favourite is waiting.').waitFor();
  await page.locator('.admin-sidebar [data-customer-section="bag"]').click();
  await page.getByRole('heading',{name:'My bag',exact:true}).waitFor();
  await page.getByText('Quantity: 2',{exact:true}).waitFor();
  await page.locator('.admin-sidebar [data-customer-section="settings"]').click();
  await page.getByRole('heading',{name:'Account settings',exact:true}).waitFor();
  assert.equal(await page.locator('#customer-section input').count(),0);
  await page.getByRole('button',{name:'Reset password',exact:true}).click();
  await page.getByRole('button',{name:'Send reset link',exact:true}).waitFor();
  await page.getByRole('button',{name:'Back to dashboard',exact:true}).click();
  await page.getByRole('heading',{name:'Welcome back, Test'}).waitFor();
  await page.locator('.admin-sidebar [data-customer-section="overview"]').click();
  await page.setViewportSize({width:1200,height:800});
  await page.screenshot({path:'artifacts/customer-desktop.png'});
  for (const width of [768,390,320]) {
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Customer dashboard fits mobile');
    assert.ok(await page.locator('.customer-content').evaluate(el=>el.scrollWidth<=el.clientWidth),'Customer content fits mobile');
    if(width===390) await page.screenshot({path:'artifacts/customer-mobile.png'});
  }
  await page.getByRole('button',{name:'Open account navigation'}).click();
  await page.getByRole('dialog',{name:'Account navigation'}).getByRole('link',{name:'My orders',exact:true}).click();
  await page.getByRole('heading',{name:'My orders',exact:true}).waitFor();
  assert.equal(await page.locator('.customer-nav-dialog').getAttribute('open'),null);
  await page.setViewportSize({width:1074,height:660});
  await page.goto('http://127.0.0.1:5174/cart.html');
  await page.getByLabel('Quantity',{exact:true}).filter({hasText:'2'}).waitFor();
  assert.equal(mergeCalls,1,'Guest bag merges only once across auth events and redirects');
  await page.goto('http://127.0.0.1:5174/admin.html');
  await page.getByText('Your account does not have administrator access.').waitFor();
  await page.goto('http://127.0.0.1:5174/account.html');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
  await page.goto('http://127.0.0.1:5174/cart.html');
  await page.getByRole('heading',{name:'A little room for something fun'}).waitFor();
  await page.goto(`http://127.0.0.1:5174/account.html#access_token=${token}&refresh_token=test-refresh-token&expires_in=3600&token_type=bearer&type=recovery`);
  await page.getByLabel('New password').fill('new-password-for-test');
  await page.getByRole('button',{name:'Save password'}).click();
  await page.getByRole('heading',{name:'Welcome back, Test'}).waitFor();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
  isAdmin = true;
  await page.getByLabel('Email',{exact:true}).fill(user.email);
  await page.getByLabel('Password',{exact:true}).fill('password-for-test');
  await Promise.all([page.waitForURL('**/admin.html'), page.getByRole('button',{name:'Sign in',exact:true}).click()]);
  await page.getByRole('heading',{name:'Products',exact:true}).waitFor();
  assert.equal(await page.locator('.customer-dashboard').count(),0);
  await page.getByRole('link',{name:'View store',exact:true}).first().click();
  await page.waitForURL('**/shop.html');
  for (const publicPage of ['index','shop','about','contact']) {
    await page.goto(`http://127.0.0.1:5174/${publicPage}.html`);
    await page.getByRole('button',{name:'Account',exact:true}).click();
    await page.waitForURL('**/admin.html');
    await page.getByRole('heading',{name:'Products',exact:true}).waitFor();
  }
  await page.goto('http://127.0.0.1:5174/account.html');
  await page.waitForURL('**/admin.html');
  // The destination is rechecked against the server, so revoked admin access
  // also returns to the normal customer account without a stale browser flag.
  isAdmin = false;
  await page.goto('http://127.0.0.1:5174/shop.html');
  await page.getByRole('button',{name:'Account',exact:true}).click();
  await page.waitForURL('**/account.html');
  await page.getByRole('heading',{name:'Welcome back, Test'}).waitFor();
  isAdmin = true;
  await page.reload();
  await page.waitForURL('**/admin.html');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.waitForURL('**/account.html');
  await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('Account browser checks passed with simulated Supabase: customer accounts, signup, recovery, admin sign-in redirect, profile navigation on all public pages, direct account redirect, role revocation and dashboard sign-out.');
} catch (error) {
  console.error('Account check page:', await page.locator('body').innerText());
  console.error('Page errors:', errors);
  console.error('Form values:', await page.locator('input').evaluateAll(inputs => inputs.map(i => ({ name:i.name, value:i.type === 'password' ? '[hidden]' : i.value, valid:i.validity.valid }))));
  throw error;
} finally { await browser.close(); await server.close(); }
