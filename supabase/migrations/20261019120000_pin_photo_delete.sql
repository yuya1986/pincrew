drop policy if exists pin_photos_delete_admin on public.pin_photos;

create policy pin_photos_delete_allowed
  on public.pin_photos
  for delete
  to authenticated
  using (
    private.is_admin()
    or user_id = (select auth.uid())
    or exists (
      select 1
      from public.pins
      where pins.id = pin_photos.pin_id
        and private.map_role(pins.map_id) in ('owner', 'editor')
    )
  );

drop policy if exists pin_photo_objects_delete on storage.objects;

create policy pin_photo_objects_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'pin-photos'
    and exists (
      select 1
      from public.pins
      where pins.id::text = (storage.foldername(objects.name))[1]
        and (
          private.is_admin()
          or pins.created_by = (select auth.uid())
          or private.map_role(pins.map_id) in ('owner', 'editor')
        )
    )
  );
