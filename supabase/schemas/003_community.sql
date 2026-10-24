-- Customer-owned submissions. Only approved content is visible on the public wall.
create table public.community_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('photo','fit','review','haul')),
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  caption text not null check (length(trim(caption)) between 1 and 1000),
  image_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  check (kind = 'review' or image_path is not null),
  check (image_path is null or image_path ~ ('^' || user_id::text || '/' || id::text || '\.(jpg|png|webp)$'))
);
create index community_shares_owner_created_idx on public.community_shares(user_id,created_at desc,id);
create index community_shares_status_created_idx on public.community_shares(status,created_at desc,id);
create index community_shares_image_idx on public.community_shares(image_path) where image_path is not null;
alter table public.community_shares enable row level security;
revoke all on public.community_shares from public,anon,authenticated;
grant select(id,kind,display_name,caption,image_path,status,created_at) on public.community_shares to anon;
grant select,insert,delete on public.community_shares to authenticated;
grant update(status) on public.community_shares to authenticated;
create policy community_public_read on public.community_shares for select to anon,authenticated using (status='approved');
create policy community_owner_admin_read on public.community_shares for select to authenticated
  using (user_id=(select auth.uid()) or (select private.is_admin()));
create policy community_submit on public.community_shares for insert to authenticated
  with check (user_id=(select auth.uid()) and status='pending');
create policy community_moderate on public.community_shares for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy community_remove on public.community_shares for delete to authenticated
  using (user_id=(select auth.uid()) or (select private.is_admin()));

-- Files stay private until a submission is approved. Signed URLs expire quickly.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('community','community',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy community_image_upload on storage.objects for insert to authenticated
  with check (bucket_id='community' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy community_image_owner_read on storage.objects for select to authenticated
  using (bucket_id='community' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_admin())));
create policy community_image_public_read on storage.objects for select to anon,authenticated
  using (bucket_id='community' and exists(select 1 from public.community_shares s where s.image_path=name and s.status='approved'));
create policy community_image_remove on storage.objects for delete to authenticated
  using (bucket_id='community' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_admin())));
