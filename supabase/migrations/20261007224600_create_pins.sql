create table public.pins (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  address text not null default '',
  title text not null default '',
  memo text not null default '',
  category text not null default '場所',
  icon text not null default 'place',
  color text not null default '#E36A4A',
  visited_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint pins_latitude_range check (latitude >= -90 and latitude <= 90),
  constraint pins_longitude_range check (longitude >= -180 and longitude <= 180)
);

create index pins_user_created_idx on public.pins (user_id, created_at desc);

alter table public.pins enable row level security;

revoke all on table public.pins from anon, authenticated;
grant select, insert, update, delete on table public.pins to authenticated;
grant select, insert, update, delete on table public.pins to service_role;

create policy pins_select_own
  on public.pins
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy pins_insert_own
  on public.pins
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy pins_update_own
  on public.pins
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy pins_delete_own
  on public.pins
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
