// Read-only checks against the configured live Supabase project and built storefront.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';
import { loadEnv, preview } from 'vite';

const env = loadEnv('production', process.cwd(), 'VITE_');
assert.ok(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Configure Supabase public environment values first');
assert.ok(env.VITE_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_'), 'Use a publishable browser key');
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const products = await client.from('products').select('id,stock_quantity').eq('active', true);
assert.ifError(products.error);
assert.ok(products.data.length > 0, 'Live catalog should contain active products');
const settings = await client.from('store_settings').select('checkout_enabled').eq('id', 1).single();
assert.ifError(settings.error);
assert.equal(settings.data.checkout_enabled, false);
for (const table of ['profiles', 'cart_items', 'favourites', 'orders', 'order_items']) {
  const result = await client.from(table).select('*').limit(1);
  assert.equal(result.error?.code, '42501', `Anonymous access to ${table} must be denied`);
}
const checkout = await client.rpc('prepare_checkout');
const publicShares=await client.from('community_shares').select('id,status').limit(4);
assert.equal(publicShares.error,null);
assert.ok(publicShares.data.every(row=>row.status==='approved'),'Public wall may only read approved submissions');
const privateShareFields=await client.from('community_shares').select('user_id').limit(1);
assert.equal(privateShareFields.error?.code,'42501','Public wall must not expose account IDs');
assert.equal(checkout.error?.code, '42501', 'Anonymous checkout RPC access must be denied');

const server = await preview({ preview: { host: '127.0.0.1', port: 5185, strictPort: true } });
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5185/index.html');
  await page.locator('#whimsy-page-loader').waitFor({state:'hidden'});
  await page.locator('.social-grid > button,.social-grid > article').first().waitFor();
  assert.equal(await page.locator('main .reveal').evaluateAll(elements=>elements.every(el=>getComputedStyle(el).opacity==='1')),true,'All public homepage sections are visible before scrolling');
  assert.deepEqual(errors, [], 'Signed-out homepage should run without errors');
  await page.goto('http://127.0.0.1:5185/shop.html');
  await page.waitForFunction(expected => document.querySelectorAll('.product-card').length === expected, products.data.length);
  assert.equal(await page.locator('.preview-banner').count(), 0, 'Connected storefront should use the live catalog');
  assert.equal(await page.locator('.store-notice.visible').count(), 0, 'Store should load without errors');
  await page.goto('http://127.0.0.1:5185/checkout.html');
  const button = page.getByRole('button', { name: 'Checkout unavailable' });
  await button.waitFor();
  assert.equal(await button.isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log(`Live Supabase checks passed: ${products.data.length} products, protected customer data, checkout disabled in settings, RPC permissions and browser.`);
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
