import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { loaderMarkup } from './src/loader-view.js';
import { applySiteLayout } from './src/site-layout.js';

export default defineConfig({
  plugins: [{
    name:'whimsy-loading-shell',
    transformIndexHtml: { order:'pre', handler(html,context) {
      html=applySiteLayout(html,context.filename);
      return { html:html.replace(/<body\b[^>]*>/i,match=>`${match}${loaderMarkup({fullPage:true})}`), tags:[
        {tag:'link',attrs:{rel:'stylesheet',href:'/src/loader.css'},injectTo:'head'},
        {tag:'script',attrs:{type:'module',src:'/src/loader.js'},injectTo:'head'},
        {tag:'noscript',children:'<style>#whimsy-page-loader{display:none!important}</style>',injectTo:'body'}
      ]};
    }}
  }],
  build: {
    rollupOptions: {
      input: Object.fromEntries(['index', 'shop', 'about', 'contact', 'account', 'cart', 'product', 'checkout', 'admin', 'policies'].map(name => [name, resolve(import.meta.dirname, `${name}.html`)]))
    }
  }
});
