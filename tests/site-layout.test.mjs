import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySiteLayout } from '../src/site-layout.js';

test('public storefront pages receive the shared header, footer, and styling scope', () => {
  const html = applySiteLayout(
    '<body class="commerce" data-page="cart"><header class="commerce-header">Old header</header><main class="commerce-main"><div id="app"></div></main><footer class="commerce-footer">Old footer</footer></body>',
    'C:\\store\\cart.html'
  );

  assert.match(html, /<body class="commerce storefront" data-page="cart">/);
  assert.match(html, /<header class="site">/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /id="main-content"/);
  assert.match(html, /<footer class="site">/);
  assert.doesNotMatch(html, /Old header|Old footer|commerce-header|commerce-footer/);
});

test('non-storefront pages retain their existing layout', () => {
  const html = '<body class="commerce account-page"><main>Account</main></body>';
  assert.equal(applySiteLayout(html, 'C:\\store\\account.html'), html);
});
