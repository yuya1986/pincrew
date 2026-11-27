alter table public.profiles add column if not exists login_id text;
alter table public.profiles add column if not exists is_active boolean not null default true;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'marathon_staff', 'admin'));

alter table public.profiles drop constraint if exists profiles_login_id_format;
alter table public.profiles
  add constraint profiles_login_id_format check (login_id is null or login_id ~ '^[a-z0-9_-]{3,30}$');

create unique index if not exists profiles_login_id_lower_idx on public.profiles (lower(login_id));

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'maps'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%map_type%'
  loop
    execute format('alter table public.maps drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.maps
  add constraint maps_map_type_check check (map_type in ('personal', 'shared', 'recommended', 'marathon'));

alter table public.pins add column if not exists created_by_label text not null default '';

create or replace function private.is_marathon_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'marathon_staff'
      and is_active
  );
$$;

revoke all on function private.is_marathon_staff() from public;
grant execute on function private.is_marathon_staff() to anon, authenticated;

create or replace function public.login_id_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate ~ '^[a-z0-9_-]{3,30}$'
    and not exists (
      select 1 from public.profiles
      where lower(login_id) = candidate
    );
$$;

revoke all on function public.login_id_available(text) from public;
grant execute on function public.login_id_available(text) to anon, authenticated;

drop policy if exists profiles_update_name on public.profiles;
create policy profiles_update_name
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) or private.is_admin())
  with check (
    private.is_admin()
    or (
      id = (select auth.uid())
      and role in ('user', 'marathon_staff')
    )
  );

drop policy if exists maps_insert_own on public.maps;
create policy maps_insert_own
  on public.maps
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (
      (map_type in ('personal', 'shared') and visibility in ('private', 'shared'))
      or (private.is_admin() and map_type = 'recommended' and visibility = 'public')
      or (private.is_admin() and map_type = 'marathon' and visibility = 'shared')
    )
  );

drop policy if exists pins_insert_allowed on public.pins;
create policy pins_insert_allowed
  on public.pins
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      private.is_admin()
      or (
        private.map_role(map_id) in ('owner', 'editor')
        and status = 'private'
      )
      or (
        status = 'pending'
        and not private.is_marathon_staff()
        and exists (
          select 1 from public.maps
          where maps.id = pins.map_id
            and maps.visibility = 'public'
            and maps.map_type = 'recommended'
        )
      )
    )
  );

alter table public.pins replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.pins;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
