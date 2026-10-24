import { loaderMarkup } from './loader-view.js';

// The initial task ends when the page's real render completes, never on a timer.
const pageTask=Symbol('initial page');
const tasks=new Set([pageTask]);
let element,blocked=new Map(),busy=new Map(),restoreFocus;

function show() {
  element=document.getElementById('whimsy-page-loader');
  if(!element){document.body.insertAdjacentHTML('afterbegin',loaderMarkup({fullPage:true}));element=document.getElementById('whimsy-page-loader');}
  if(!element.hidden && blocked.size)return;
  restoreFocus=document.activeElement;
  element.hidden=false;
  document.documentElement.classList.add('whimsy-is-loading');
  document.body.classList.add('whimsy-is-loading');
  for(const child of document.body.children){
    if(child===element||['SCRIPT','STYLE','LINK','NOSCRIPT'].includes(child.tagName))continue;
    blocked.set(child,child.inert);child.inert=true;
  }
  for(const main of document.querySelectorAll('main')){busy.set(main,main.getAttribute('aria-busy'));main.setAttribute('aria-busy','true');}
}
function hide() {
  if(tasks.size)return;
  element=document.getElementById('whimsy-page-loader');if(element)element.hidden=true;
  for(const [child,wasInert] of blocked)child.inert=wasInert;
  blocked.clear();
  for(const [main,prior] of busy){if(prior===null)main.removeAttribute('aria-busy');else main.setAttribute('aria-busy',prior);}
  busy.clear();
  document.documentElement.classList.remove('whimsy-is-loading');document.body.classList.remove('whimsy-is-loading');
  if(restoreFocus?.isConnected && restoreFocus!==document.body)restoreFocus.focus({preventScroll:true});
  restoreFocus=null;
}
export function finishPageLoading(){tasks.delete(pageTask);hide();}
export function beginPageLoading(){const token=Symbol('loading');tasks.add(token);show();let finished=false;return ()=>{if(finished)return;finished=true;tasks.delete(token);hide();};}
export function startContextLoading(target,message='') {
  const prior=target.getAttribute('aria-busy');target.setAttribute('aria-busy','true');
  const wrapper=document.createElement('div');wrapper.innerHTML=loaderMarkup();const loader=wrapper.firstElementChild;
  // Keep gradient IDs unique when more than one contextual loader is visible.
  const id=`whimsy-gradient-${crypto.randomUUID()}`;
  loader.querySelector('linearGradient').id=id;loader.querySelector('.whimsy-loader-ring').style.stroke=`url(#${id})`;
  const label=loader.querySelector('.whimsy-loader-message');label.textContent=message;label.hidden=!message;target.replaceChildren(loader);
  return ()=>{loader.remove();if(prior===null)target.removeAttribute('aria-busy');else target.setAttribute('aria-busy',prior);};
}
show();
