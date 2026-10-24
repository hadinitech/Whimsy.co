-- Product photographs are public assets; only store administrators can manage them.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy product_images_upload on storage.objects for insert to authenticated
  with check (bucket_id='product-images' and (select private.is_admin())
    and name ~ '^p[0-9]+/[0-9a-f-]{36}\.(jpg|png|webp)$');
create policy product_images_admin_read on storage.objects for select to authenticated
  using (bucket_id='product-images' and (select private.is_admin()));
create policy product_images_remove on storage.objects for delete to authenticated
  using (bucket_id='product-images' and (select private.is_admin()));
