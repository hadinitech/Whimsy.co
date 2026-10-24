create table public.favourites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index favourites_product_idx on public.favourites(product_id);
alter table public.favourites enable row level security;
revoke all on public.favourites from public, anon, authenticated;
grant select, insert, delete on public.favourites to authenticated;
create policy favourites_own_read on public.favourites for select to authenticated
using (user_id = (select auth.uid()));
create policy favourites_own_insert on public.favourites for insert to authenticated
with check (user_id = (select auth.uid()) and exists (select 1 from public.products p where p.id = product_id and p.active));
create policy favourites_own_delete on public.favourites for delete to authenticated
using (user_id = (select auth.uid()));
