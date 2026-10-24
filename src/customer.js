import { store, supabase } from './store.js';
import { beginPageLoading } from './loader.js';
import { mountShareDashboard } from './community.js';
import { customerShell,customerMetrics,customerOverview,customerOrders,customerBag,customerSettings } from './customer-views.js';
let dashboard;
export function unmountCustomerDashboard(){dashboard?.destroy();dashboard=null;document.body.classList.remove('customer-dashboard','admin-page');}
export async function mountCustomerDashboard(root,onPasswordReset){
  dashboard?.destroy();dashboard=new CustomerDashboard(root,onPasswordReset);await dashboard.mount();
}
class CustomerDashboard{
  constructor(root,onPasswordReset){this.root=root;this.onPasswordReset=onPasswordReset;this.owner=store.user.id;this.abort=new AbortController();this.orders=[];this.error='';}
  get current(){return !this.abort.signal.aborted&&store.user?.id===this.owner;}
  destroy(){this.abort.abort();this.unsubscribe?.();this.root.querySelector('.customer-nav-dialog[open]')?.close();}
  async fetchOrders(){try{this.orders=await store.orders();this.error='';}catch(error){this.error=error.message;}}
  async mount(){
    await this.fetchOrders();if(!this.current)return;
    document.body.classList.add('customer-dashboard','admin-page');
    this.root.innerHTML=customerShell();this.target=this.root.querySelector('#customer-section');this.nav=this.root.querySelector('.customer-nav-dialog');
    const options={signal:this.abort.signal};
    this.root.addEventListener('click',event=>this.click(event).catch(error=>window.whimsyNotice(error.message)),options);
    window.addEventListener('hashchange',()=>this.render(),options);
    this.unsubscribe=store.subscribe(()=>{if(this.current)this.render(false);});
    this.render();
  }
  render(resetScroll=true){
    if(!this.current)return;
    const section=['orders','bag','settings','shares'].includes(location.hash.slice(1))?location.hash.slice(1):'overview';
    this.root.querySelectorAll('[data-customer-section]').forEach(link=>{if(link.dataset.customerSection===section)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    this.root.querySelector('.customer-metrics').innerHTML=customerMetrics(this.orders,this.error);
    // Background session/bag refreshes must not replace an in-progress share form.
    if(section==='shares'&&!resetScroll&&this.target.querySelector('#customer-shares'))return;
    this.target.innerHTML=section==='shares'?'<div id="customer-shares"></div>':section==='orders'?customerOrders(this.orders,this.error):section==='bag'?customerBag():section==='settings'?customerSettings():customerOverview(this.orders,this.error);
    if(section==='shares')mountShareDashboard(this.target.firstElementChild,'mine');
    if(this.nav.open)this.nav.close();
    if(resetScroll)this.root.querySelector('.customer-content').scrollTop=0;
  }
  async click(event){
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-customer-open-nav'))this.nav.showModal();
    else if(button.hasAttribute('data-customer-close-nav'))this.nav.close();
    else if(button.hasAttribute('data-customer-password'))this.onPasswordReset();
    else if(button.hasAttribute('data-retry-customer-orders')){
      const finish=beginPageLoading();button.disabled=true;
      try{await this.fetchOrders();this.render();}finally{finish();button.disabled=false;}
    }else if(button.hasAttribute('data-customer-signout')){
      button.disabled=true;
      try{const result=await supabase.auth.signOut();if(result.error)throw result.error;await store.session(null);sessionStorage.removeItem('whimsy.passwordRecovery');this.destroy();location.replace('account.html');}
      catch(error){button.disabled=false;throw error;}
    }
  }
}
