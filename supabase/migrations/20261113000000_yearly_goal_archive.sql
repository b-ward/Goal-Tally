begin;

-- Record which goals are closed and their final totals without rewriting goals or tallies.
create table public.goal_archive_entries (
  goal_id uuid primary key references public.goals (id) on delete restrict,
  user_id uuid not null,
  archive_year integer not null check (archive_year >= 1900),
  final_count bigint not null check (final_count >= 0)
);

create index goal_archive_entries_owner_year_idx
  on public.goal_archive_entries (user_id, archive_year desc);
create index if not exists tallies_goal_created_idx on public.tallies (goal_id, created_at desc);

alter table public.goal_archive_entries enable row level security;
revoke all on public.goal_archive_entries from public, anon, authenticated;
grant select on public.goal_archive_entries to authenticated;
create policy read_own_goal_archive_entries on public.goal_archive_entries
  for select to authenticated using (user_id = (select auth.uid()));

-- Also protect archived goals and their tally history from writes by older clients.
create function public.guard_archived_goal()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.goal_archive_entries where goal_id = old.id) then
    raise exception 'Archived goals cannot be changed.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger guard_archived_goal
  before update or delete on public.goals
  for each row execute function public.guard_archived_goal();

create function public.guard_archived_goal_tally()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    if exists (select 1 from public.goal_archive_entries where goal_id = old.goal_id) then
      raise exception 'Tallies for archived goals cannot be changed.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if exists (select 1 from public.goal_archive_entries where goal_id = new.goal_id) then
    raise exception 'Tallies for archived goals cannot be changed.';
  end if;
  return new;
end;
$$;

create trigger guard_archived_goal_tally
  before insert or update or delete on public.tallies
  for each row execute function public.guard_archived_goal_tally();

create function public.archive_goal_year(p_year integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then
    raise exception 'Sign in to archive your goals.';
  end if;
  if p_year is null or p_year < 1900 or
    p_year > extract(year from (now() at time zone 'Pacific/Kiritimati')) then
    raise exception 'Choose a valid archive year.';
  end if;

  -- Serialize archives and briefly wait for in-flight edits before taking the snapshot.
  -- Plain reads can continue. Later edits see the archive entries and are rejected.
  lock table public.goals, public.tallies in share row exclusive mode;

  if exists (select 1 from public.goal_archive_entries where user_id = owner_id and archive_year = p_year) then
    raise exception 'You already have an archive for this year.';
  end if;

  insert into public.goal_archive_entries (goal_id, user_id, archive_year, final_count)
  select g.id, owner_id, p_year, (select count(*) from public.tallies t where t.goal_id = g.id)
  from public.goals g
  where g.user_id = owner_id
    and not exists (select 1 from public.goal_archive_entries a where a.goal_id = g.id);

  if not found then
    raise exception 'There are no active goals to archive.';
  end if;
end;
$$;

-- Count in Postgres so a long tally history cannot hit the API row limit.
create function public.get_goal_results(p_archived boolean)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', g.id, 'name', g.name, 'color', g.color, 'emoji', g.emoji,
      'position', g.position, 'created_at', g.created_at, 'archive_year', a.archive_year,
      'count', coalesce(a.final_count, (select count(*) from public.tallies t where t.goal_id = g.id))
    ) order by a.archive_year desc, g.position, g.created_at, g.id
  ), '[]'::jsonb)
  from public.goals g
  left join public.goal_archive_entries a on a.goal_id = g.id
  where g.user_id = (select auth.uid()) and (a.goal_id is not null) = p_archived;
$$;

revoke execute on function public.guard_archived_goal(), public.guard_archived_goal_tally(),
  public.archive_goal_year(integer), public.get_goal_results(boolean) from public, anon, authenticated;
grant execute on function public.archive_goal_year(integer), public.get_goal_results(boolean) to authenticated;

commit;
