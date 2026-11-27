create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table public.maps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  visibility text not null check (visibility in ('private', 'shared', 'public')),
  map_type text not null check (map_type in ('personal', 'shared', 'recommended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.map_members (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (map_id, user_id)
);

create table public.map_invites (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index maps_owner_idx on public.maps (owner_id);
create index maps_visibility_idx on public.maps (visibility);
create index map_members_user_idx on public.map_members (user_id);
create index map_invites_map_idx on public.map_invites (map_id);

alter table public.pins
  add column map_id uuid references public.maps (id) on delete cascade,
  add column created_by uuid references auth.users (id) on delete set null,
  add column status text not null default 'private' check (status in ('private', 'pending', 'approved', 'rejected'));

create index pins_map_idx on public.pins (map_id);
create index pins_status_idx on public.pins (status);

insert into public.profiles (id, display_name, role)
select users.id, '', case when admins.user_id is null then 'user' else 'admin' end
from auth.users as users
left join public.admins as admins on admins.user_id = users.id
on conflict (id) do update set role = excluded.role;

insert into public.maps (owner_id, name, description, visibility, map_type)
select id, 'マイマップ', '', 'private', 'personal'
from public.profiles
where not exists (
  select 1 from public.maps
  where maps.owner_id = profiles.id and maps.map_type = 'personal'
);

insert into public.map_members (map_id, user_id, role)
select maps.id, maps.owner_id, 'owner'
from public.maps
where maps.map_type = 'personal'
on conflict (map_id, user_id) do nothing;

insert into public.maps (owner_id, name, description, visibility, map_type)
select profiles.id, recommended.name, '', 'public', 'recommended'
from public.profiles as profiles
cross join (
  values ('グルメ'), ('カフェ'), ('観光'), ('スポーツ'), ('買い物')
) as recommended (name)
where profiles.role = 'admin'
  and not exists (
    select 1 from public.maps
    where maps.owner_id = profiles.id
      and maps.map_type = 'recommended'
      and maps.name = recommended.name
  );

update public.pins
set
  created_by = coalesce(pins.user_id, personal.owner_id),
  map_id = personal.id,
  status = 'private'
from public.maps as personal
where pins.map_id is null
  and personal.map_type = 'personal'
  and personal.owner_id = coalesce(
    pins.user_id,
    (select profiles.id from public.profiles where profiles.role = 'admin' order by profiles.created_at limit 1)
  );

alter table public.pins alter column map_id set not null;

create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function private.map_role(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select members.role
  from public.map_members as members
  where members.map_id = target
    and members.user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.map_role(uuid) from public;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.map_role(uuid) to anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  personal uuid;
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, '', 'user')
  on conflict (id) do nothing;

  insert into public.maps (owner_id, name, description, visibility, map_type)
  values (new.id, 'マイマップ', '', 'private', 'personal')
  returning id into personal;

  insert into public.map_members (map_id, user_id, role)
  values (personal, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function public.join_map(invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'login required';
  end if;

  select invites.map_id into target
  from public.map_invites as invites
  where invites.id = invite_id;

  if target is null then
    raise exception 'invite not found';
  end if;

  insert into public.map_members (map_id, user_id, role)
  values (target, (select auth.uid()), 'viewer')
  on conflict (map_id, user_id) do nothing;

  return target;
end;
$$;

revoke all on function public.join_map(uuid) from public;
grant execute on function public.join_map(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.maps enable row level security;
alter table public.map_members enable row level security;
alter table public.map_invites enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.maps from anon, authenticated;
revoke all on table public.map_members from anon, authenticated;
revoke all on table public.map_invites from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant select on table public.maps to anon, authenticated;
grant insert, update, delete on table public.maps to authenticated;
grant select, insert, update, delete on table public.map_members to authenticated;
grant select, insert, delete on table public.map_invites to authenticated;

drop policy if exists pins_select_shared on public.pins;
drop policy if exists pins_insert_shared on public.pins;
drop policy if exists pins_update_admin on public.pins;
drop policy if exists pins_delete_admin on public.pins;

revoke all on table public.pins from anon, authenticated;
grant select on table public.pins to anon, authenticated;
grant insert, update, delete on table public.pins to authenticated;

create policy profiles_select_related
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or private.is_admin()
    or exists (
      select 1
      from public.map_members as mine
      join public.map_members as theirs on theirs.map_id = mine.map_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = profiles.id
    )
  );

create policy profiles_update_name
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) or private.is_admin())
  with check (
    private.is_admin()
    or (id = (select auth.uid()) and role = 'user')
  );

create policy maps_select_visible
  on public.maps
  for select
  to anon, authenticated
  using (
    visibility = 'public'
    or private.is_admin()
    or private.map_role(id) is not null
  );

create policy maps_insert_own
  on public.maps
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (
      (map_type in ('personal', 'shared') and visibility in ('private', 'shared'))
      or (private.is_admin() and map_type = 'recommended' and visibility = 'public')
    )
  );

create policy maps_update_owner
  on public.maps
  for update
  to authenticated
  using (owner_id = (select auth.uid()) or private.is_admin())
  with check (owner_id = (select auth.uid()) or private.is_admin());

create policy maps_delete_owner
  on public.maps
  for delete
  to authenticated
  using (
    (owner_id = (select auth.uid()) and map_type <> 'personal')
    or private.is_admin()
  );

create policy members_select
  on public.map_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_admin()
    or private.map_role(map_id) is not null
  );

create policy members_insert
  on public.map_members
  for insert
  to authenticated
  with check (
    private.is_admin()
    or (
      private.map_role(map_id) = 'owner'
      and role in ('editor', 'viewer', 'owner')
    )
    or (
      user_id = (select auth.uid())
      and role = 'owner'
      and exists (
        select 1 from public.maps
        where maps.id = map_id and maps.owner_id = (select auth.uid())
      )
    )
  );

create policy members_update
  on public.map_members
  for update
  to authenticated
  using (private.is_admin() or private.map_role(map_id) = 'owner')
  with check (
    (private.is_admin() or private.map_role(map_id) = 'owner')
    and role in ('owner', 'editor', 'viewer')
  );

create policy members_delete
  on public.map_members
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_admin()
    or private.map_role(map_id) = 'owner'
  );

create policy invites_select
  on public.map_invites
  for select
  to authenticated
  using (
    private.is_admin()
    or private.map_role(map_id) in ('owner', 'editor')
  );

create policy invites_insert
  on public.map_invites
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (private.is_admin() or private.map_role(map_id) = 'owner')
  );

create policy invites_delete
  on public.map_invites
  for delete
  to authenticated
  using (private.is_admin() or private.map_role(map_id) = 'owner');

create policy pins_select_visible
  on public.pins
  for select
  to anon, authenticated
  using (
    private.is_admin()
    or (
      status = 'approved'
      and exists (
        select 1 from public.maps
        where maps.id = pins.map_id and maps.visibility = 'public'
      )
    )
    or private.map_role(map_id) is not null
    or created_by = (select auth.uid())
  );

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
        and exists (
          select 1 from public.maps
          where maps.id = pins.map_id
            and maps.visibility = 'public'
            and maps.map_type = 'recommended'
        )
      )
    )
  );

create policy pins_update_allowed
  on public.pins
  for update
  to authenticated
  using (
    private.is_admin()
    or private.map_role(map_id) in ('owner', 'editor')
    or created_by = (select auth.uid())
  )
  with check (
    private.is_admin()
    or (
      private.map_role(map_id) in ('owner', 'editor')
      and status = 'private'
    )
    or (
      created_by = (select auth.uid())
      and status = 'pending'
    )
  );

create policy pins_delete_allowed
  on public.pins
  for delete
  to authenticated
  using (
    private.is_admin()
    or private.map_role(map_id) in ('owner', 'editor')
    or (created_by = (select auth.uid()) and status = 'pending')
  );

notify pgrst, 'reload schema';
