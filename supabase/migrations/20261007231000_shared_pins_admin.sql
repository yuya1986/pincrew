alter table public.pins alter column user_id drop not null;
alter table public.pin_photos alter column user_id drop not null;

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.admins enable row level security;

revoke all on table public.admins from anon, authenticated;
grant select on table public.admins to authenticated;

create policy admins_select_self
  on public.admins
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

insert into public.admins (user_id)
select id
from auth.users
order by created_at
limit 1
on conflict (user_id) do nothing;

drop policy if exists pins_select_own on public.pins;
drop policy if exists pins_insert_own on public.pins;
drop policy if exists pins_update_own on public.pins;
drop policy if exists pins_delete_own on public.pins;

revoke all on table public.pins from anon, authenticated;
grant select, insert on table public.pins to anon;
grant select, insert, update, delete on table public.pins to authenticated;

create policy pins_select_shared
  on public.pins
  for select
  to anon, authenticated
  using (true);

create policy pins_insert_shared
  on public.pins
  for insert
  to anon, authenticated
  with check (
    (
      (select auth.uid()) is null
      and user_id is null
    )
    or user_id = (select auth.uid())
  );

create policy pins_update_admin
  on public.pins
  for update
  to authenticated
  using (
    exists (
      select 1 from public.admins
      where admins.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.admins
      where admins.user_id = (select auth.uid())
    )
    and (user_id is null or user_id = (select auth.uid()))
  );

create policy pins_delete_admin
  on public.pins
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.admins
      where admins.user_id = (select auth.uid())
    )
  );

drop policy if exists pin_photos_select_own on public.pin_photos;
drop policy if exists pin_photos_insert_own on public.pin_photos;
drop policy if exists pin_photos_delete_own on public.pin_photos;

revoke all on table public.pin_photos from anon, authenticated;
grant select, insert on table public.pin_photos to anon;
grant select, insert, delete on table public.pin_photos to authenticated;

create policy pin_photos_select_shared
  on public.pin_photos
  for select
  to anon, authenticated
  using (true);

create policy pin_photos_insert_shared
  on public.pin_photos
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.pins
      where pins.id = pin_id
    )
    and (
      (
        (select auth.uid()) is null
        and user_id is null
      )
      or user_id = (select auth.uid())
    )
  );

create policy pin_photos_delete_admin
  on public.pin_photos
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.admins
      where admins.user_id = (select auth.uid())
    )
  );

drop policy if exists pin_photo_objects_insert on storage.objects;
drop policy if exists pin_photo_objects_select on storage.objects;
drop policy if exists pin_photo_objects_update on storage.objects;
drop policy if exists pin_photo_objects_delete on storage.objects;

create policy pin_photo_objects_select
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'pin-photos');

create policy pin_photo_objects_insert
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'pin-photos'
    and exists (
      select 1
      from public.pins
      where pins.id::text = (storage.foldername(name))[1]
    )
  );

create policy pin_photo_objects_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'pin-photos'
    and exists (
      select 1 from public.admins
      where admins.user_id = (select auth.uid())
    )
  );
