-- Declarative source of truth. Generate migrations with the Supabase CLI.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.products (
  id text primary key check (id ~ '^p[0-9]+$'),
  name text not null check (length(name) between 1 and 200),
  description text not null default '' check (length(description) <= 5000),
  price_cents integer not null check (price_cents between 1 and 10000000),
  stock_quantity integer not null default 0 check (stock_quantity between 0 and 1000000),
  category text not null check (category in ('totes', 'pins')),
  collections text[] not null default '{}',
  mood text not null default '' check (mood in ('', 'relatable', 'unhinged', 'chaotic', 'whimsical', 'cute')),
  badge text not null default '' check (badge in ('', 'new', 'popular', 'limited', 'back', 'last', 'unhinged')),
  icon text not null default 'tote' check (icon in ('tote','toteFace','toteLines','pinRound','pinStar','pinDouble','pinHeart','keychain','pinCat')),
  image_url text not null default '' check (image_url = '' or image_url ~ '^https://'),
  rating integer not null default 0 check (rating between 0 and 5),
  sort_order integer not null default 0 check (sort_order >= 0),
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create index products_active_sort_idx on public.products (sort_order) where active;

create table private.store_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table private.store_admins enable row level security;
revoke all on private.store_admins from public, anon, authenticated;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from private.store_admins where user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
create function public.is_store_admin() returns boolean
language sql stable security invoker set search_path = '' as $$ select private.is_admin(); $$;
revoke all on function public.is_store_admin() from public, anon;
grant execute on function public.is_store_admin() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 100),
  phone text not null default '' check (length(phone) <= 30),
  address_line1 text not null default '' check (length(address_line1) <= 200),
  address_line2 text not null default '' check (length(address_line2) <= 200),
  city text not null default '' check (length(city) <= 100),
  province text not null default '' check (length(province) <= 100),
  postal_code text not null default '' check (postal_code = '' or postal_code ~ '^[0-9]{4}$')
);
create table public.cart_items (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id text not null references public.products(id),
  quantity integer not null check (quantity between 1 and 99),
  primary key (user_id, product_id)
);
create index cart_items_product_idx on public.cart_items (product_id);
create table public.cart_merges (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  merge_key uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, merge_key)
);

create table public.store_settings (
  id integer primary key default 1 check (id = 1),
  checkout_enabled boolean not null default false check (checkout_enabled = false),
  shipping_cents integer check (shipping_cents >= 0),
  free_shipping_threshold_cents integer check (free_shipping_threshold_cents >= 0),
  vat_registered boolean,
  payment_provider text check (payment_provider in ('payfast', 'yoco', 'stripe'))
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  status text not null default 'pending_payment' check (status in ('pending_payment','paid','fulfilled','cancelled','refunded')),
  customer_email text not null,
  delivery_address jsonb not null check (jsonb_typeof(delivery_address) = 'object'),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null check (shipping_cents >= 0),
  tax_cents integer not null check (tax_cents >= 0),
  total_cents integer not null check (total_cents = subtotal_cents + shipping_cents + tax_cents),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  payment_reference text unique,
  tracking_reference text not null default '' check (length(tracking_reference) <= 200),
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);
create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id),
  product_name text not null,
  unit_price_cents integer not null check (unit_price_cents > 0),
  quantity integer not null check (quantity between 1 and 99),
  unique (order_id, product_id)
);
create index order_items_product_idx on public.order_items (product_id);

-- No customer or administrator can directly create orders or mark payments paid.
-- Gateway integration will add a separately reviewed server-only order transaction.
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.cart_items enable row level security;
alter table public.cart_merges enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.products, public.profiles, public.cart_items, public.cart_merges,
  public.store_settings, public.orders, public.order_items from anon, authenticated;
grant select on public.products, public.store_settings to anon, authenticated;
grant insert, update on public.products to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant select, insert on public.cart_merges to authenticated;
grant select on public.orders, public.order_items to authenticated;

create policy products_public_read on public.products for select to anon using (active);
create policy products_customer_read on public.products for select to authenticated using (active or (select private.is_admin()));
create policy products_admin_insert on public.products for insert to authenticated with check ((select private.is_admin()));
create policy products_admin_update on public.products for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy profiles_own_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_own_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_own_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy cart_own on public.cart_items for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy merges_own_read on public.cart_merges for select to authenticated using (user_id = (select auth.uid()));
create policy merges_own_insert on public.cart_merges for insert to authenticated with check (user_id = (select auth.uid()));
create policy settings_read on public.store_settings for select to anon, authenticated using (true);
create policy orders_own_or_admin on public.orders for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy items_own_or_admin on public.order_items for select to authenticated using (exists (
  select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select private.is_admin()))
));

create function private.validate_cart() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.products p where p.id = new.product_id and p.active and p.stock_quantity >= new.quantity) then
    raise exception 'That quantity is unavailable.';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_cart() from public, anon, authenticated;
create trigger validate_cart before insert or update on public.cart_items
for each row execute function private.validate_cart();

create function public.set_cart_quantity(product text, amount integer) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if amount is null or amount < 0 or amount > 99 then raise exception 'Invalid quantity'; end if;
  if amount = 0 then delete from public.cart_items where user_id = auth.uid() and product_id = product;
  else
    insert into public.cart_items(user_id, product_id, quantity) values (auth.uid(), product, amount)
    on conflict (user_id, product_id) do update set quantity = excluded.quantity;
  end if;
end;
$$;
revoke all on function public.set_cart_quantity(text, integer) from public, anon;
grant execute on function public.set_cart_quantity(text, integer) to authenticated;

create function public.merge_guest_cart(items jsonb, merge_key uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare item jsonb; requested integer; available integer; product text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 100 or merge_key is null then raise exception 'Invalid bag'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 0));
  insert into public.cart_merges(user_id, merge_key) values (auth.uid(), merge_key) on conflict do nothing;
  if not found then return; end if;
  for item in select value from jsonb_array_elements(items) loop
    product := item->>'product_id';
    if jsonb_typeof(item->'quantity') <> 'number' or (item->>'quantity') !~ '^[0-9]{1,2}$' then raise exception 'Invalid quantity'; end if;
    requested := (item->>'quantity')::integer;
    select p.stock_quantity into available from public.products p where p.id = product and p.active;
    if available > 0 and requested > 0 then
      insert into public.cart_items(user_id,product_id,quantity) values (auth.uid(),product,least(99,available,requested))
      on conflict (user_id,product_id) do update set quantity = least(99,available,public.cart_items.quantity + excluded.quantity);
    end if;
  end loop;
end;
$$;
revoke all on function public.merge_guest_cart(jsonb, uuid) from public, anon;
grant execute on function public.merge_guest_cart(jsonb, uuid) to authenticated;

create function public.prepare_checkout() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  raise exception 'Checkout is not open yet. No order has been placed.';
end;
$$;
revoke all on function public.prepare_checkout() from public, anon;
grant execute on function public.prepare_checkout() to authenticated;

create function private.fulfill_order(order_id uuid, tracking text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Administrator access required'; end if;
  if tracking is null or length(trim(tracking)) not between 1 and 200 then raise exception 'A tracking reference is required'; end if;
  update public.orders set status = 'fulfilled', tracking_reference = trim(tracking), fulfilled_at = now()
  where id = order_id and status = 'paid';
  if not found then raise exception 'Only a paid order can be fulfilled'; end if;
end;
$$;
revoke all on function private.fulfill_order(uuid, text) from public, anon;
grant execute on function private.fulfill_order(uuid, text) to authenticated;
create function public.fulfill_order(order_id uuid, tracking text) returns void
language sql security invoker set search_path = '' as $$ select private.fulfill_order(order_id, tracking); $$;
revoke all on function public.fulfill_order(uuid, text) from public, anon;
grant execute on function public.fulfill_order(uuid, text) to authenticated;
