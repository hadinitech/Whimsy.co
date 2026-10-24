export const money = cents => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export function cleanCart(input) {
  if (!Array.isArray(input)) return [];
  const merged = new Map();
  for (const item of input) {
    if (typeof item?.product_id !== 'string' || !/^p\d+$/.test(item.product_id)) continue;
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) continue;
    merged.set(item.product_id, Math.min(99, (merged.get(item.product_id) || 0) + item.quantity));
  }
  return [...merged].map(([product_id, quantity]) => ({ product_id, quantity }));
}
export function cartLines(cart, products) {
  return cleanCart(cart).map(item => {
    const product = products.find(p => p.id === item.product_id);
    return { ...item, product, total: product ? product.price_cents * item.quantity : 0, available: Boolean(product?.stock && item.quantity <= product.stock_quantity) };
  });
}
export function safeImage(url) {
  try { const parsed = new URL(url, location.origin); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : ''; } catch { return ''; }
}
