begin;

alter table public.goal_archive_entries
  add column archive_id uuid,
  add column archive_name text,
  drop constraint goal_archive_entries_archive_or_backup,
  add constraint goal_archive_entries_archive_or_backup check (
    (archive_year is not null and archive_id is null and archive_name is null and backup_id is null and backed_up_at is null)
    or (archive_year is null and archive_id is not null and archive_name is not null
      and btrim(archive_name) <> '' and backup_id is null and backed_up_at is null)
    or (archive_year is null and archive_id is null and archive_name is null and backup_id is not null and backed_up_at is not null)
  );

create index goal_archive_entries_owner_archive_idx
  on public.goal_archive_entries (user_id, archive_id) where archive_id is not null;

create function public.archive_goal_set(p_name text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  new_archive_id uuid := gen_random_uuid();
  archive_name text := btrim(p_name);
begin
  if owner_id is null then
    raise exception 'Sign in to archive your goals.';
  end if;
  if archive_name is null or archive_name = '' then
    raise exception 'Enter a name for this archive.';
  end if;

  lock table public.goals, public.tallies in share row exclusive mode;

  insert into public.goal_archive_entries (goal_id, user_id, archive_id, archive_name, final_count)
  select g.id, owner_id, new_archive_id, archive_name,
    (select count(*) from public.tallies t where t.goal_id = g.id)
  from public.goals g
  where g.user_id = owner_id
    and not exists (select 1 from public.goal_archive_entries a where a.goal_id = g.id);

  if not found then
    raise exception 'There are no active goals to archive.';
  end if;
end;
$$;

revoke execute on function public.archive_goal_set(text) from public, anon, authenticated;
grant execute on function public.archive_goal_set(text) to authenticated;

create or replace function public.restore_goal_archive(p_goal_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  archive public.goal_archive_entries%rowtype;
  new_backup_id uuid := gen_random_uuid();
  backup_time timestamptz := statement_timestamp();
begin
  if owner_id is null then
    raise exception 'Sign in to restore your goals.';
  end if;

  -- Use the same locks as archive_goal_set so the whole replacement is atomic.
  lock table public.goals, public.tallies in share row exclusive mode;

  select a.* into archive
  from public.goal_archive_entries a
  where a.user_id = owner_id and a.goal_id = p_goal_id;

  if not found then
    raise exception 'This archive is no longer available. Refresh and try again.';
  end if;

  insert into public.goal_archive_entries (goal_id, user_id, backup_id, backed_up_at, final_count)
  select g.id, owner_id, new_backup_id, backup_time,
    (select count(*) from public.tallies t where t.goal_id = g.id)
  from public.goals g
  where g.user_id = owner_id
    and not exists (select 1 from public.goal_archive_entries a where a.goal_id = g.id);

  delete from public.goal_archive_entries a
  where a.user_id = owner_id
    and (a.archive_id = archive.archive_id
      or a.archive_year = archive.archive_year
      or a.backup_id = archive.backup_id);
end;
$$;

create or replace function public.get_goal_results(p_archived boolean)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', g.id, 'name', g.name, 'color', g.color, 'emoji', g.emoji,
      'position', g.position, 'created_at', g.created_at, 'archive_year', a.archive_year,
      'archive_id', a.archive_id, 'archive_name', a.archive_name, 'archived_at', a.archived_at,
      'backup_id', a.backup_id, 'backed_up_at', a.backed_up_at,
      'count', coalesce(a.final_count, (select count(*) from public.tallies t where t.goal_id = g.id))
    ) order by coalesce(a.backed_up_at, a.archived_at) desc nulls last,
      a.archive_year desc, g.position, g.created_at, g.id
  ), '[]'::jsonb)
  from public.goals g
  left join public.goal_archive_entries a on a.goal_id = g.id
  where g.user_id = (select auth.uid()) and (a.goal_id is not null) = p_archived;
$$;

commit;
