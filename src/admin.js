import './admin.css';
import { store, supabase, escapeHTML as esc } from './store.js';
import { checked, loadProducts, loadOrderPage, saveProduct, updateProduct, visibleProducts } from './admin-data.js';
import { shell, overview, metrics, productSection, productRows, productEditor, ordersSection, settingsSection } from './admin-views.js';
import { startContextLoading } from './loader.js';
import { mountShareDashboard } from './community.js';
import { productImageExtension } from './product-images.js';

let dashboard;
export async function mountAdmin(root) {
  dashboard?.destroy();
  dashboard = new Dashboard(root);
  await dashboard.mount();
}
class Dashboard {
  constructor(root) {
    this.root=root; this.owner=store.user.id; this.abort=new AbortController();
    this.state={search:'',filter:'all',sort:'name'}; this.products=[]; this.orders=[];this.orderCount=0;this.orderPage=0;this.section='products';this.renderId=0;
  }
  get current() { return !this.abort.signal.aborted && store.user?.id===this.owner; }
  destroy() { this.abort.abort();this.clearImagePreview();this.root.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close()); }
  async mount() {
    const [products,page,settings]=await Promise.all([loadProducts(),loadOrderPage(),supabase.from('store_settings').select('*').eq('id',1).single().then(checked)]);
    if (!this.current) return;
    this.products=products;this.orders=page.orders;this.orderCount=page.count;this.settings=settings;
    this.root.innerHTML=shell();
    this.content=this.root.querySelector('.admin-content');this.target=this.root.querySelector('#admin-section');this.editor=this.root.querySelector('.admin-edit-dialog');this.nav=this.root.querySelector('.admin-nav-dialog');
    const options={signal:this.abort.signal};
    this.root.addEventListener('click',event=>this.click(event).catch(error=>window.whimsyNotice(error.message)),options);
    this.root.addEventListener('submit',event=>this.submit(event),options);
    this.root.addEventListener('input',event=>{if(event.target.matches('.admin-search input')){this.state.search=event.target.value;this.renderRows();}},options);
    this.root.addEventListener('change',event=>{if(event.target.matches('.admin-sort select')){this.state.sort=event.target.value;this.renderRows();}else if(event.target.matches('[name=image_file]'))this.previewImage(event.target);},options);
    this.root.addEventListener('keydown',event=>{if(event.key==='Escape')this.root.querySelectorAll('.admin-row-actions details[open]').forEach(el=>el.open=false);},options);
    this.editor.addEventListener('cancel',event=>{if(this.saving)event.preventDefault();},options);
    this.editor.addEventListener('close',()=>this.clearImagePreview(),options);
    window.addEventListener('hashchange',()=>this.navigate().catch(error=>this.sectionError(error)),options);
    this.renderOverview();await this.navigate();
  }
  renderOverview() {
    if(!this.current)return;
    this.root.querySelector('.admin-overview').innerHTML=overview(store.profile,store.user,this.settings);
    this.root.querySelector('.admin-metrics').innerHTML=metrics(this.products,this.orderCount);
  }
  async navigate() {
    const section=location.hash.slice(1);
    this.section=['products','inventory','orders','settings','shares'].includes(section)?section:'products';
    this.root.querySelectorAll('[data-section]').forEach(link=>{if(link.dataset.section===this.section)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    if(this.nav.open)this.nav.close();
    this.content.scrollTop=0;
    await this.renderSection();
  }
  async renderSection() {
    const renderId=++this.renderId;
    if(['products','inventory'].includes(this.section)) {
      this.target.innerHTML=productSection(this.section,this.products,this.state);
      this.target.querySelector('select').value=this.state.sort;
      this.renderRows();
    } else if(this.section==='shares'){
      this.target.innerHTML='<div id="admin-shares"></div>';
      await mountShareDashboard(this.target.firstElementChild,'admin');
    } else if(this.section==='settings')this.target.innerHTML=settingsSection(this.settings);
    else {
      this.target.innerHTML='<div class="admin-panel"><div class="admin-orders-loading"></div></div>';
      const finish = startContextLoading(this.target.firstElementChild.firstElementChild, 'Loading your orders...');
      let page;
      try { page=await loadOrderPage(this.orderPage); } finally { finish(); }
      if(!this.current||renderId!==this.renderId)return;
      this.orders=page.orders;this.orderCount=page.count;this.renderOverview();
      this.target.innerHTML=ordersSection(this.orders,this.orderCount,this.orderPage);
    }
  }
  sectionError(error) {
    if(!this.current)return;
    this.target.innerHTML=`<div class="admin-panel"><h2>We couldn’t load this section.</h2><p>${esc(error.message)}</p><button class="admin-button" data-retry>Try again</button></div>`;
  }
  renderRows() {
    if(!this.current||!['products','inventory'].includes(this.section))return;
    const products=visibleProducts(this.products,this.state);
    this.target.querySelector('#admin-product-list').innerHTML=productRows(products,this.section==='inventory');
    this.target.querySelector('.admin-list-count').textContent=`Showing ${products.length} of ${this.products.length} products`;
    this.target.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===this.state.filter)));
  }
  async refreshProducts() {
    this.products=await loadProducts();
    if(!this.current)return;
    this.renderOverview();await this.renderSection();
    await store.loadProducts();
  }
  openEditor(id,stockOnly=false) {
    if(this.saving)return;
    const isNew=!id;
    const product=isNew?{id:`p${Math.max(0,...this.products.map(p=>Number(p.id.slice(1))))+1}`,name:'',price_cents:0,stock_quantity:0,category:'pins',sort_order:Math.max(0,...this.products.map(p=>p.sort_order))+1,active:false}:this.products.find(p=>p.id===id);
    if(!product)throw new Error('This product is no longer available. Refresh and try again.');
    this.clearImagePreview();this.editingImage=product.image_url||'';
    this.editingNew=isNew;this.editor.innerHTML=productEditor(product,isNew);this.editor.showModal();
    if(stockOnly)this.editor.querySelector('[name=stock_quantity]').focus();
  }
  clearImagePreview(){if(this.previewUrl){URL.revokeObjectURL(this.previewUrl);this.previewUrl=null;}}
  previewImage(input){
    this.clearImagePreview();input.setCustomValidity('');
    const preview=this.editor.querySelector('.admin-image-preview'),note=this.editor.querySelector('#edit-image-note');
    const file=input.files[0];
    try{
      if(file){productImageExtension(file);this.previewUrl=URL.createObjectURL(file);}
      const source=this.previewUrl||this.editingImage;
      if(source)preview.src=source;else preview.removeAttribute('src');
      preview.hidden=!source;
      note.textContent='JPG, PNG or WebP, up to 5 MB. The image uploads when you save the product.';
    }catch(error){input.setCustomValidity(error.message);note.textContent=error.message;preview.hidden=true;}
  }
  async click(event) {
    const target=event.target.closest('button,a');if(!target)return;
    if(target.hasAttribute('data-signout')) {
      target.disabled=true;
      try{checked(await supabase.auth.signOut());await store.session(null);this.destroy();location.replace('account.html');}
      catch(error){target.disabled=false;throw error;}
    } else if(target.hasAttribute('data-open-nav'))this.nav.showModal();
    else if(target.hasAttribute('data-close-nav'))this.nav.close();
    else if(target.hasAttribute('data-close-edit')){if(!this.saving)this.editor.close();}
    else if(target.hasAttribute('data-add'))this.openEditor();
    else if(target.dataset.edit)this.openEditor(target.dataset.edit);
    else if(target.dataset.editStock)this.openEditor(target.dataset.editStock,true);
    else if(target.dataset.toggle) {
      const product=this.products.find(p=>p.id===target.dataset.toggle);target.disabled=true;
      try{await updateProduct(product.id,{active:!product.active});await this.refreshProducts();window.whimsyNotice(product.active?'Product hidden from shop.':'Product is visible in the shop.');}
      finally{target.disabled=false;}
    } else if(target.dataset.filter){this.state.filter=target.dataset.filter;this.renderRows();}
    else if(target.hasAttribute('data-metric-filter')){
      this.state.filter=target.dataset.metricFilter;this.state.search='';
      if(location.hash===target.getAttribute('href')){event.preventDefault();await this.renderSection();}
    } else if(target.dataset.orderPage){this.orderPage+=target.dataset.orderPage==='next'?1:-1;await this.renderSection();}
    else if(target.hasAttribute('data-retry'))await this.renderSection();
  }
  async submit(event) {
    const form=event.target;
    if(!form.matches('.admin-editor-form,.admin-stock-form,.admin-fulfill-form'))return;
    event.preventDefault();
    const button=form.querySelector('[type=submit]');button.disabled=true;
    const data=new FormData(form);
    try {
      if(form.matches('.admin-editor-form')) {
        this.saving=true;
        const progress=form.querySelector('.form-result');progress.classList.remove('store-error');progress.textContent=data.get('image_file')?.size?'Uploading image and saving product…':'Saving product…';
        await saveProduct({id:form.dataset.product,name:data.get('name'),price_cents:Math.round(Number(data.get('price'))*100),stock_quantity:Number(data.get('stock_quantity')),category:data.get('category'),description:data.get('description'),image_url:this.editingImage,sort_order:Number(data.get('sort_order')),active:data.has('active'),collections:['new','bestseller'].filter(c=>data.has(c))},this.editingNew,data.get('image_file'));
        this.editor.close();await this.refreshProducts();
        (this.target.querySelector(`[data-product-id="${form.dataset.product}"] summary`) || this.target.querySelector('[data-add]'))?.focus();
        window.whimsyNotice('Product saved.');
      } else if(form.matches('.admin-stock-form')) {
        await updateProduct(form.dataset.stock,{stock_quantity:Number(data.get('stock'))});
        await this.refreshProducts();window.whimsyNotice('Stock updated.');
      } else {
        checked(await supabase.rpc('fulfill_order',{order_id:form.dataset.order,tracking:data.get('tracking')}));
        await this.renderSection();window.whimsyNotice('Order marked fulfilled.');
      }
    } catch(error) {
      const result=form.querySelector('.form-result');
      if(result){result.textContent=error.message;result.classList.add('store-error');}else window.whimsyNotice(error.message);
    } finally {button.disabled=false;this.saving=false;}
  }
}
