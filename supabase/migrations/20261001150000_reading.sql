-- Reading: timeline ordering, a per-user entry view, counts and state changes.

-- Timeline order --------------------------------------------------------------

-- Feeds sometimes omit dates or post-date entries. Order by the publication
-- date, but never later than when we first saw the entry, so a bogus future
-- date cannot pin an entry to the top.
alter table public.entries
  add column sort_at timestamptz generated always as (least(published_at, created_at)) stored;

-- In a BEFORE trigger, stored generated columns are still NULL in NEW, so a
-- whole-row comparison would see every update as a change. Ignore the
-- columns named in the trigger's arguments (plus updated_at itself).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ignored text[] := array['updated_at'] || tg_argv;
begin
  if (to_jsonb(new) - ignored) is distinct from (to_jsonb(old) - ignored) then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger entries_set_updated_at on public.entries;
create trigger entries_set_updated_at
before update on public.entries
for each row execute function public.set_updated_at('sort_at');

drop index public.entries_feed_published_at_idx;
create index entries_feed_sort_at_idx on public.entries (feed_id, sort_at desc, id desc);
create index entries_sort_at_idx on public.entries (sort_at desc, id desc);

-- Entry list view -------------------------------------------------------------

-- One row per entry the caller can see, with the caller's own read/starred
-- state. security_invoker makes the underlying tables' RLS apply to the caller,
-- so the view exposes nothing the tables would not.
create view public.entry_list
with (security_invoker = true)
as
select
  e.id,
  e.feed_id,
  f.title as feed_title,
  f.feed_url,
  e.title,
  e.url,
  e.author,
  e.summary,
  e.content,
  -- Enough raw text for a one-line preview without shipping whole articles.
  left(coalesce(e.summary, e.content), 600) as excerpt_source,
  e.published_at,
  e.sort_at,
  s.read_at is not null as is_read,
  s.starred_at is not null as is_starred,
  s.starred_at
from public.entries e
join public.feeds f on f.id = e.feed_id
left join public.entry_states s
  on s.entry_id = e.id
  and s.user_id = (select auth.uid());

revoke all on public.entry_list from anon, authenticated;
grant select on public.entry_list to authenticated;

-- Counts ----------------------------------------------------------------------

-- Per-feed totals for the sidebar. Runs as the caller (RLS applies).
create function public.entry_counts()
returns table (feed_id uuid, total bigint, unread bigint, starred bigint)
language sql
stable
set search_path = ''
as $$
  select
    e.feed_id,
    count(*),
    count(*) filter (where s.read_at is null),
    count(*) filter (where s.starred_at is not null)
  from public.entries e
  left join public.entry_states s
    on s.entry_id = e.id
    and s.user_id = (select auth.uid())
  group by e.feed_id;
$$;

-- State changes ---------------------------------------------------------------

-- Sets read and/or starred for one entry; null leaves that flag unchanged.
-- Runs as the caller: the entry_states policies decide whether it is allowed.
-- (A direct upsert from the API would need UPDATE on entry_id, which users do
-- not get.)
create function public.set_entry_state(
  p_entry_id uuid,
  p_read boolean default null,
  p_starred boolean default null
)
returns void
language sql
volatile
set search_path = ''
as $$
  insert into public.entry_states as s (entry_id, read_at, starred_at)
  values (
    p_entry_id,
    case when p_read then now() end,
    case when p_starred then now() end
  )
  on conflict (user_id, entry_id) do update set
    read_at = case
      when p_read is null then s.read_at
      when p_read then coalesce(s.read_at, now())
    end,
    starred_at = case
      when p_starred is null then s.starred_at
      when p_starred then coalesce(s.starred_at, now())
    end;
$$;

-- Marks every unread entry as read, optionally within one feed. Returns how
-- many entries changed.
create function public.mark_entries_read(p_feed_id uuid default null)
returns integer
language sql
volatile
set search_path = ''
as $$
  with changed as (
    insert into public.entry_states as s (entry_id, read_at)
    select e.id, now()
    from public.entries e
    where (p_feed_id is null or e.feed_id = p_feed_id)
      and not exists (
        select 1
        from public.entry_states x
        where x.entry_id = e.id
          and x.user_id = (select auth.uid())
          and x.read_at is not null
      )
    on conflict (user_id, entry_id) do update set read_at = now()
    returning 1
  )
  select count(*)::integer from changed;
$$;

revoke execute on function public.entry_counts() from public, anon;
revoke execute on function public.set_entry_state(uuid, boolean, boolean) from public, anon;
revoke execute on function public.mark_entries_read(uuid) from public, anon;
grant execute on function public.entry_counts() to authenticated;
grant execute on function public.set_entry_state(uuid, boolean, boolean) to authenticated;
grant execute on function public.mark_entries_read(uuid) to authenticated;
