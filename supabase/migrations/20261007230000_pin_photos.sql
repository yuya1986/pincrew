insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pin-photos', 'pin-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy pin_photo_objects_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'pin-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy pin_photo_objects_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'pin-photos'
    and owner_id = (select auth.uid())::text
  );

create policy pin_photo_objects_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'pin-photos'
    and owner_id = (select auth.uid())::text
  )
  with check (
    bucket_id = 'pin-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy pin_photo_objects_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'pin-photos'
    and owner_id = (select auth.uid())::text
  );

create table public.pin_photos (
  id uuid primary key,
  pin_id uuid not null references public.pins (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index pin_photos_pin_created_idx on public.pin_photos (pin_id, created_at);

alter table public.pin_photos enable row level security;

revoke all on table public.pin_photos from anon, authenticated;
grant select, insert, delete on table public.pin_photos to authenticated;
grant select, insert, delete on table public.pin_photos to service_role;

create policy pin_photos_select_own
  on public.pin_photos
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy pin_photos_insert_own
  on public.pin_photos
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.pins
      where pins.id = pin_id
        and pins.user_id = (select auth.uid())
    )
  );

create policy pin_photos_delete_own
  on public.pin_photos
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
