import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanCart, cartLines, money, escapeHTML } from '../src/core.js';

test('stored bags reject corrupt quantities, collapse duplicates, and cap totals', () => {
  assert.deepEqual(cleanCart([{product_id:'p1',quantity:80},{product_id:'p1',quantity:80},{product_id:'p2',quantity:-1},{product_id:'p3',quantity:1.5},{product_id:'x',quantity:2},null]), [{product_id:'p1',quantity:99}]);
  assert.deepEqual(cleanCart({}), []);
});
test('bag totals use current catalog prices and flag removed or depleted products', () => {
  const lines = cartLines([{product_id:'p1',quantity:2},{product_id:'p2',quantity:1}], [{id:'p1',price_cents:12000,stock:true,stock_quantity:1}]);
  assert.equal(lines[0].total, 24000);
  assert.equal(lines[0].available, false);
  assert.equal(lines[1].total, 0);
  assert.equal(lines[1].available, false);
  assert.match(money(12000), /120[.,]00/);
});
test('customer and catalog text is escaped before insertion into HTML', () => {
  assert.equal(escapeHTML('<img onerror="x">&\''), '&lt;img onerror=&quot;x&quot;&gt;&amp;&#39;');
});
