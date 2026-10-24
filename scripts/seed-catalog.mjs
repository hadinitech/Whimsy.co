import { writeFileSync } from 'node:fs';
import { SAMPLE_PRODUCTS } from '../src/catalog.js';
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const rows = SAMPLE_PRODUCTS.map(p => `(${[p.id, p.name].map(literal).join(',')},${p.price * 100},0,${literal(p.category)},array[${p.collections.map(literal).join(',')}]::text[],${[p.mood, p.badge, p.icon].map(literal).join(',')},${p.rating},${p.order},true)`);
writeFileSync('supabase/seed.sql', `-- Catalog imported from the original storefront. Set real stock before launch.\ninsert into public.store_settings(id) values (1) on conflict do nothing;\ninsert into public.products(id,name,price_cents,stock_quantity,category,collections,mood,badge,icon,rating,sort_order,active) values\n${rows.join(',\n')}\non conflict (id) do nothing;\n`);
