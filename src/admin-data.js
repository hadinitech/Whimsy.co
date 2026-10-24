import { supabase } from './store.js';
import { uploadProductImage,discardUnusedProductImage } from './product-images.js';

export const LOW_STOCK_LIMIT = 5;
export const checked = result => { if (result.error) throw result.error; return result.data; };
export const stockStatus = quantity => quantity === 0 ? 'out' : quantity <= LOW_STOCK_LIMIT ? 'low' : 'in';
export const statusLabel = status => ({ out:'Out of stock', low:'Low stock', in:'In stock' }[status]);
export const firstName = (profile, user) => {
  const name = [profile?.full_name, user?.user_metadata?.first_name, user?.user_metadata?.full_name, user?.user_metadata?.display_name].find(value => typeof value === 'string' && value.trim());
  return name ? name.trim().split(/\s+/)[0] : '';
};
export function productCounts(products) {
  return { all:products.length, in:products.filter(p => p.stock_quantity > 0).length,
    low:products.filter(p => stockStatus(p.stock_quantity) === 'low').length,
    out:products.filter(p => stockStatus(p.stock_quantity) === 'out').length };
}
export function visibleProducts(products, { search, filter, sort }) {
  const query = search.trim().toLowerCase();
  const list = products.filter(p => (!query || `${p.name} ${p.category}`.toLowerCase().includes(query)) &&
    (filter === 'all' || filter === 'in' && p.stock_quantity > 0 || filter === 'low' && stockStatus(p.stock_quantity) === 'low' || filter === 'out' && !p.stock_quantity));
  return list.sort((a,b) => ({name:() => a.name.localeCompare(b.name), newest:() => b.sort_order-a.sort_order,
    price:() => a.price_cents-b.price_cents, stock:() => a.stock_quantity-b.stock_quantity}[sort] || (() => 0))() || a.id.localeCompare(b.id));
}
export async function loadProducts() {
  const products = [];
  for (let start=0;;start+=1000) {
    const batch = checked(await supabase.from('products').select('*').order('sort_order').order('id').range(start,start+999));
    products.push(...batch);
    if (batch.length < 1000) return products;
  }
}
export async function loadOrderPage(page = 0) {
  const response = await supabase.from('orders').select('*,order_items(*)', {count:'exact'})
    .order('created_at',{ascending:false}).order('id').range(page*25,page*25+24);
  return { orders:checked(response), count:response.count ?? 0 };
}
export async function saveProduct(product,isNew=false,file=null) {
  const image=file?.size?await uploadProductImage(product.id,file):null;
  try{
    const payload=image?{...product,image_url:image.url}:product;
    checked(await (isNew ? supabase.from('products').insert(payload) : supabase.from('products').upsert(payload)));
  }catch(error){
    if(image)await discardUnusedProductImage(image);
    throw error;
  }
}
export async function updateProduct(id, changes) {
  const data = checked(await supabase.from('products').update(changes).eq('id',id).select('id'));
  if (!data?.length) throw new Error('This product could not be updated. Check your access and try again.');
}
