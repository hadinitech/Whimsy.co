-- Temporary capability for seven exact image paths; revoked by the next migration.
do $import$ begin execute format(
'create policy product_images_scoped_import on storage.objects for insert to authenticated with check (bucket_id=''product-images'' and (select auth.uid())=''64cd16e7-93fc-4d94-ad97-bffc721c34e5''::uuid and name=any(array[''p1/5701a871-e482-4a4e-9047-004bc19ebd11.png'',''p2/0c7bbd7d-cd65-492c-b31f-d2b33841a662.png'',''p4/217db56c-caa0-4b2e-974c-49f0fc487c85.png'',''p5/f1679585-6e7f-47e4-8325-968f547bab5d.png'',''p6/514c261e-0b56-4c1d-b2ee-bff69496e4a8.png'',''p7/f647f157-c343-4c17-9716-955c04ae2398.png'',''p17/b2fc5337-bdb7-439c-af82-218e4f0526df.png'']) and now()<%L::timestamptz)',
now()+interval '15 minutes'); end $import$;
