begin;

-- Keep the creation time unknown for existing yearly archives.
alter table public.goal_archive_entries add column archived_at timestamptz;
alter table public.goal_archive_entries alter column archived_at set default statement_timestamp();

create or replace function public.get_goal_results(p_archived boolean)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', g.id, 'name', g.name, 'color', g.color, 'emoji', g.emoji,
      'position', g.position, 'created_at', g.created_at, 'archive_year', a.archive_year,
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
