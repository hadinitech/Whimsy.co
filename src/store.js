import { createClient } from '@supabase/supabase-js';
import { SAMPLE_PRODUCTS } from './catalog.js';
import { cleanCart, cartLines } from './core.js';
export { money, escapeHTML, safeImage } from './core.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
const guestKey = 'whimsy.cart.v1';
const favouritesKey = 'whimsy.favourites.v1';
const readFavourites = () => { try { const saved=JSON.parse(localStorage.getItem(favouritesKey)||'[]'); return Array.isArray(saved)?[...new Set(saved.filter(id=>typeof id==='string' && /^p\d+$/.test(id)))]:[]; } catch { return []; } };
const check = result => { if (result.error) throw result.error; return result.data; };
const readGuest = () => { try { return cleanCart(JSON.parse(localStorage.getItem(guestKey) || '[]')); } catch { return []; } };

class Store {
  products = [];
  cart = readGuest();
  user = null;
  profile = null;
  favourites = readFavourites();
  favouriteQueue = Promise.resolve();
  error = '';
  settings = null;
  listeners = new Set();
  busy = Promise.resolve();
  sessionQueue = Promise.resolve();
  ready = this.init();
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const listener of this.listeners) listener(); }
  get lines() { return cartLines(this.cart, this.products); }
  get subtotal() { return this.lines.reduce((sum, item) => sum + item.total, 0); }
  get count() { return this.cart.reduce((sum, item) => sum + item.quantity, 0); }
  async init() {
    window.addEventListener('storage',event=>{if(!this.user&&event.key===favouritesKey){this.favourites=readFavourites();this.emit();}});
    if (!supabase) {
      this.products = SAMPLE_PRODUCTS.map(p => ({ ...p, price_cents: p.price * 100, stock_quantity: p.stock ? 99 : 0, description: '', image_url: '' }));
      window.addEventListener('storage', event => { if (event.key === guestKey) { this.cart = readGuest(); this.emit(); } });
      this.emit(); return;
    }
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem('whimsy.passwordRecovery', '1');
        window.dispatchEvent(new Event('whimsy:recovery'));
      }
      setTimeout(async () => {
        await this.ready;
        this.session(session?.user ?? null).catch(error => { this.error = error.message; this.emit(); });
      }, 0);
    });
    try {
      await this.loadProducts();
      this.settings = check(await supabase.from('store_settings').select('*').eq('id', 1).single());
      const { user } = check(await supabase.auth.getUser());
      await this.session(user);
    } catch (error) { if (!error.message?.includes('Auth session missing')) this.error = error.message; }
    this.emit();
    window.addEventListener('focus', () => this.refresh().catch(error => { this.error = error.message; this.emit(); }));
    window.addEventListener('storage', event => { if (!this.user && event.key === guestKey) { this.cart = readGuest(); this.emit(); } });
  }
  async loadProducts() {
    this.products = check(await supabase.from('products').select('*').eq('active', true).order('sort_order')).map(p => ({ ...p, price: p.price_cents / 100, stock: p.stock_quantity > 0, order: p.sort_order }));
  }
  session(user) {
    this.sessionQueue = this.sessionQueue.catch(() => {}).then(() => this.loadSession(user));
    return this.sessionQueue;
  }
  async loadSession(user) {
    // Never retain the previous customer's cart or personal details during an account switch.
    const changed = this.user?.id !== user?.id;
    this.user = user; this.profile = null;
    if (changed) this.favourites = user ? [] : readFavourites();
    if (changed) { this.cart = user ? [] : readGuest(); this.emit(); }
    if (user) {
      this.profile = check(await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle());
      const guest = readGuest();
      if (guest.length) {
        const mergeKey = localStorage.getItem(`${guestKey}.merge`) || crypto.randomUUID();
        localStorage.setItem(`${guestKey}.merge`, mergeKey);
        check(await supabase.rpc('merge_guest_cart', { items: guest, merge_key: mergeKey }));
        localStorage.removeItem(guestKey); localStorage.removeItem(`${guestKey}.merge`);
      }
      this.cart = check(await supabase.from('cart_items').select('product_id,quantity').eq('user_id', user.id));
      await this.loadFavourites(user.id);
    } else { this.cart = readGuest(); this.favourites = readFavourites(); }
    this.emit();
  }
  async refresh() { if (!supabase) return; await this.loadProducts(); await this.session(this.user); }
  setQuantity(id, quantity) {
    const action = async () => {
      if (typeof quantity === 'function') quantity = quantity(this.cart.find(item => item.product_id === id)?.quantity || 0);
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) throw new Error('Choose a quantity from 1 to 99.');
      const p = this.products.find(p => p.id === id);
      if (quantity && (!p?.stock || quantity > p.stock_quantity)) throw new Error('That quantity is unavailable. Please update your bag.');
      if (this.user) {
        check(await supabase.rpc('set_cart_quantity', { product: id, amount: quantity }));
        this.cart = check(await supabase.from('cart_items').select('product_id,quantity').eq('user_id', this.user.id));
      } else {
        this.cart = cleanCart([...this.cart.filter(i => i.product_id !== id), { product_id: id, quantity }]);
        localStorage.setItem(guestKey, JSON.stringify(this.cart));
      }
      this.emit();
    };
    this.busy = this.busy.catch(() => {}).then(action);
    return this.busy;
  }
  add(id) { return this.setQuantity(id, current => current + 1); }
  async orders() { return this.user ? check(await supabase.from('orders').select('*,order_items(*)').order('created_at', { ascending: false })) : []; }
  async accountDestination() {
    await this.ready;
    if (!supabase || !this.user) return 'account.html';
    return check(await supabase.rpc('is_store_admin')) ? 'admin.html' : 'account.html';
  }
  async loadFavourites(owner=this.user?.id) {
    if(!owner)return;
    const guest=readFavourites().filter(id=>this.products.some(p=>p.id===id));
    if(guest.length){
      check(await supabase.from('favourites').upsert(guest.map(product_id=>({user_id:owner,product_id})),{onConflict:'user_id,product_id',ignoreDuplicates:true}));
      localStorage.removeItem(favouritesKey);
    }
    const rows=check(await supabase.from('favourites').select('product_id').eq('user_id',owner));
    if(this.user?.id===owner)this.favourites=rows.map(row=>row.product_id);
  }
  toggleFavourite(id) {
    const owner=this.user?.id;
    const action=async()=>{
      if(this.user?.id!==owner)throw new Error('Your session changed. Please try again.');
      if(!this.products.some(p=>p.id===id))throw new Error('This product is not available.');
      const selected=this.favourites.includes(id);
      if(owner){
        if(selected)check(await supabase.from('favourites').delete().eq('user_id',owner).eq('product_id',id));
        else check(await supabase.from('favourites').upsert({user_id:owner,product_id:id},{onConflict:'user_id,product_id',ignoreDuplicates:true}));
        await this.loadFavourites(owner);
      }else{
        this.favourites=selected?this.favourites.filter(saved=>saved!==id):[...this.favourites,id];
        localStorage.setItem(favouritesKey,JSON.stringify(this.favourites));
      }
      this.emit();return !selected;
    };
    this.favouriteQueue=this.favouriteQueue.catch(()=>{}).then(action);return this.favouriteQueue;
  }
  async saveProfile(data) {
    check(await supabase.from('profiles').upsert({ id: this.user.id, ...data }));
    this.profile = data; this.emit();
  }
}
export const store = new Store();
