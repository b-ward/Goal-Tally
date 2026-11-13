begin;

-- Backups made by restore are separate from the once-per-year archives.
alter table public.goal_archive_entries
  alter column archive_year drop not null,
  add column backup_id uuid,
  add column backed_up_at timestamptz,
  add constraint goal_archive_entries_archive_or_backup check (
    (archive_year is not null and backup_id is null and backed_up_at is null)
    or (archive_year is null and backup_id is not null and backed_up_at is not null)
  );

create function public.restore_goal_archive(p_goal_id uuid)
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

  -- Use the same locks as archive_goal_year so the whole replacement is atomic.
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
    and (a.archive_year = archive.archive_year or a.backup_id = archive.backup_id);
end;
$$;

revoke execute on function public.restore_goal_archive(uuid) from public, anon, authenticated;
grant execute on function public.restore_goal_archive(uuid) to authenticated;

create or replace function public.get_goal_results(p_archived boolean)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', g.id, 'name', g.name, 'color', g.color, 'emoji', g.emoji,
      'position', g.position, 'created_at', g.created_at, 'archive_year', a.archive_year,
      'backup_id', a.backup_id, 'backed_up_at', a.backed_up_at,
      'count', coalesce(a.final_count, (select count(*) from public.tallies t where t.goal_id = g.id))
    ) order by a.backed_up_at desc nulls last, a.archive_year desc, g.position, g.created_at, g.id
  ), '[]'::jsonb)
  from public.goals g
  left join public.goal_archive_entries a on a.goal_id = g.id
  where g.user_id = (select auth.uid()) and (a.goal_id is not null) = p_archived;
$$;

commit;
