-- Add archives, goal targets, and tracking periods to an existing Goal Tally database.
-- Use this file if none of the five feature migrations have been applied.
-- Run this entire file once in the Supabase SQL Editor.

begin;

-- 20261113000000_yearly_goal_archive.sql
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

-- 20261113000001_restore_goal_archive.sql
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

-- 20261113000002_order_goal_archives.sql
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

-- 20261113000003_named_goal_archives.sql
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

-- 20261113000004_goal_targets_and_tracking_period.sql
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
