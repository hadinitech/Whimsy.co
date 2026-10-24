import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('store schema enforces ownership, admin privileges, stock and disabled checkout in PostgreSQL', async t => {
  const db = new PGlite();
  const alice = '11111111-1111-4111-8111-111111111111';
  const bob = '22222222-2222-4222-8222-222222222222';
  const admin = '33333333-3333-4333-8333-333333333333';
  const paid = '44444444-4444-4444-8444-444444444444';
  const pending = '55555555-5555-4555-8555-555555555555';
  const as = async id => { await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`); };
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
    await db.exec(readFileSync('supabase/schemas/001_store.sql', 'utf8'));
    await db.exec(readFileSync('supabase/schemas/002_favourites.sql', 'utf8'));
    await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
    await db.exec(`insert into auth.users values ('${alice}'),('${bob}'),('${admin}'); insert into private.store_admins values ('${admin}'); update products set stock_quantity = 3 where id = 'p1'; insert into profiles(id,full_name) values ('${alice}','Alice'),('${bob}','Bob'); insert into orders(id,user_id,status,customer_email,delivery_address,subtotal_cents,shipping_cents,tax_cents,total_cents) values ('${paid}','${alice}','paid','alice@example.test','{}',45000,0,0,45000),('${pending}','${bob}','pending_payment','bob@example.test','{}',45000,0,0,45000); insert into order_items(order_id,product_id,product_name,unit_price_cents,quantity) values ('${paid}','p1','Original purchased name',45000,1),('${pending}','p1','Other customer purchase',45000,1);`);
    await t.test('anonymous visitors can read catalog, never customer data or privileged RPCs', async () => {
      await db.exec('set role anon;');
      assert.equal((await db.query('select count(*)::int n from products')).rows[0].n, 24);
      await assert.rejects(db.query('select * from profiles'), /permission denied/);
      await assert.rejects(db.query("select set_cart_quantity('p1',1)"), /permission denied/);
      await assert.rejects(db.query('select is_store_admin()'), /permission denied/);
    });
    await t.test('a customer sees only their profile, orders and line snapshots', async () => {
      await as(alice);
      assert.deepEqual((await db.query('select full_name from profiles')).rows, [{full_name:'Alice'}]);
      assert.equal((await db.query('select id from orders')).rows.length, 1);
      assert.deepEqual((await db.query('select product_name from order_items')).rows, [{product_name:'Original purchased name'}]);
      assert.equal((await db.query('select is_store_admin() admin')).rows[0].admin, false);
      await assert.rejects(db.query(`update profiles set id='${bob}' where id='${alice}'`), /row-level security/);
      await assert.rejects(db.query(`insert into profiles(id) values('${admin}')`), /row-level security/);
      await assert.rejects(db.query('select * from private.store_admins'), /permission denied/);
    });
    await t.test('customers cannot edit prices, mark paid, or create orders', async () => {
      assert.equal((await db.query("update products set price_cents=1 where id='p1' returning id")).rows.length, 0);
      await assert.rejects(db.query(`update orders set status='paid' where id='${pending}'`), /permission denied/);
      await assert.rejects(db.query(`insert into orders(user_id,customer_email,delivery_address,subtotal_cents,shipping_cents,tax_cents,total_cents) values('${alice}','a@b.test','{}',1,0,0,1)`), /permission denied/);
      await assert.rejects(db.query('select prepare_checkout()'), /Checkout is not open yet/);
      await assert.rejects(db.query('update store_settings set checkout_enabled=true'), /permission denied/);
    });
    await t.test('stock and quantity checks also apply to direct API writes', async () => {
      await db.query("select set_cart_quantity('p1',2)");
      await assert.rejects(db.query("select set_cart_quantity('p1',4)"), /unavailable/);
      await assert.rejects(db.query("select set_cart_quantity('p1',-1)"), /Invalid quantity/);
      await assert.rejects(db.query("select set_cart_quantity('p1',null)"), /Invalid quantity/);
      await assert.rejects(db.query("insert into cart_items(product_id,quantity) values('p2',1)"), /unavailable/);
      await assert.rejects(db.query(`insert into cart_items(user_id,product_id,quantity) values('${bob}','p1',1)`), /row-level security/);
      await as(bob);
      assert.equal((await db.query('select * from cart_items')).rows.length, 0);
      await as(alice);
      await db.query("select set_cart_quantity('p1',0)");
      assert.equal((await db.query('select * from cart_items')).rows.length, 0);
    });
    await t.test('guest bag merge is atomic, stock capped and idempotent on retry', async () => {
      const key = '66666666-6666-4666-8666-666666666666';
      const sql = `select merge_guest_cart('[{"product_id":"p1","quantity":2},{"product_id":"p2","quantity":1}]','${key}')`;
      await db.query(sql); await db.query(sql);
      assert.equal((await db.query('select quantity from cart_items')).rows[0].quantity, 2);
      await db.query(`select merge_guest_cart('[{"product_id":"p1","quantity":8}]','77777777-7777-4777-8777-777777777777')`);
      assert.equal((await db.query('select quantity from cart_items')).rows[0].quantity, 3);
      await assert.rejects(db.query(`select merge_guest_cart('[{"product_id":"p1","quantity":-1}]','88888888-8888-4888-8888-888888888888')`), /Invalid quantity/);
    });
    await t.test('only admins can manage products and fulfill an already paid order', async () => {
      await assert.rejects(db.query(`select fulfill_order('${paid}','TRACK1')`), /Administrator access required/);
      await as(admin);
      assert.equal((await db.query('select is_store_admin() admin')).rows[0].admin, true);
      assert.equal((await db.query('select id from orders')).rows.length, 2);
      await db.query("update products set price_cents=49000 where id='p1'");
      assert.equal((await db.query(`select unit_price_cents from order_items where order_id='${paid}'`)).rows[0].unit_price_cents, 45000);
      await assert.rejects(db.query(`select fulfill_order('${pending}','TRACK1')`), /Only a paid order/);
      await db.query(`select fulfill_order('${paid}','TRACK1')`);
      assert.equal((await db.query(`select status from orders where id='${paid}'`)).rows[0].status, 'fulfilled');
      await assert.rejects(db.query(`select fulfill_order('${paid}','TRACK1')`), /Only a paid order/);
      await assert.rejects(db.query(`update orders set status='paid' where id='${pending}'`), /permission denied/);
    });
    await t.test('favourites are private, account-owned, and reject hidden products', async () => {
      await as(alice);
      await db.query("insert into favourites(product_id) values('p1') on conflict do nothing");
      await db.query("insert into favourites(product_id) values('p1') on conflict do nothing");
      assert.equal((await db.query('select * from favourites')).rows.length,1);
      await as(bob);
      assert.equal((await db.query('select * from favourites')).rows.length,0);
      await assert.rejects(db.query(`insert into favourites(user_id,product_id) values('${alice}','p2')`),/row-level security/);
      assert.equal((await db.query(`delete from favourites where user_id='${alice}' returning product_id`)).rows.length,0);
      await db.query("insert into favourites(product_id) values('p1')");
      assert.equal((await db.query('select * from favourites')).rows.length,1);
      await db.exec("reset role; update products set active=false where id='p2';");
      await as(alice);
      await assert.rejects(db.query("insert into favourites(product_id) values('p2')"),/row-level security/);
      await db.query("delete from favourites where product_id='p1'");
      assert.equal((await db.query('select * from favourites')).rows.length,0);
      await db.exec('reset role; set role anon;');
      await assert.rejects(db.query('select * from favourites'),/permission denied/);
    });
    await t.test('privileged functions are private and every exposed table has RLS', async () => {
      await db.exec('reset role;');
      assert.equal((await db.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef")).rows[0].n, 0);
      assert.equal((await db.query("select count(*)::int n from pg_tables where schemaname='public' and not rowsecurity")).rows[0].n, 0);
      await assert.rejects(db.query('update store_settings set checkout_enabled=true'), /check constraint/);
    });
  } finally { await db.close(); }
});
