alter table public.pins
  add column if not exists deleted_at timestamptz;

create index if not exists pins_deleted_at_idx
  on public.pins (deleted_at desc)
  where deleted_at is not null;

drop policy if exists pins_select_visible on public.pins;
create policy pins_select_visible
  on public.pins
  for select
  to anon, authenticated
  using (
    private.is_admin()
    or (
      deleted_at is null
      and (
        (
          status = 'approved'
          and exists (
            select 1 from public.maps
            where maps.id = pins.map_id and maps.visibility = 'public'
          )
        )
        or private.map_role(map_id) is not null
        or created_by = (select auth.uid())
      )
    )
  );

drop policy if exists pins_update_allowed on public.pins;
create policy pins_update_allowed
  on public.pins
  for update
  to authenticated
  using (
    private.is_admin()
    or (
      deleted_at is null
      and (
        private.map_role(map_id) in ('owner', 'editor')
        or created_by = (select auth.uid())
      )
    )
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

notify pgrst, 'reload schema';
