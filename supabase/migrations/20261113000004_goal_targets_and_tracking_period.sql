begin;

alter table public.goals add column target integer check (target > 0);

create table public.goal_tracking_periods (
  user_id uuid primary key references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date)
);

alter table public.goal_tracking_periods enable row level security;
revoke all on public.goal_tracking_periods from public, anon, authenticated;
grant select, insert, update on public.goal_tracking_periods to authenticated;
create policy manage_own_goal_tracking_period on public.goal_tracking_periods
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create function public.get_goal_tracking_period()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object('start_date', start_date, 'end_date', end_date)
  from public.goal_tracking_periods
  where user_id = (select auth.uid());
$$;

create function public.save_goal_tracking_period(p_start date, p_end date)
returns void language sql security invoker set search_path = ''
as $$
  insert into public.goal_tracking_periods (user_id, start_date, end_date)
  values ((select auth.uid()), p_start, p_end)
  on conflict (user_id) do update
  set start_date = excluded.start_date, end_date = excluded.end_date;
$$;

revoke execute on function public.get_goal_tracking_period(), public.save_goal_tracking_period(date, date)
  from public, anon, authenticated;
grant execute on function public.get_goal_tracking_period(), public.save_goal_tracking_period(date, date)
  to authenticated;

create or replace function public.get_goal_results(p_archived boolean)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', g.id, 'target', g.target, 'name', g.name, 'color', g.color, 'emoji', g.emoji,
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
