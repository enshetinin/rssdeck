-- Retention: prune old entries without letting them come back as new.
--
-- Deleting an entry that is still in the feed's XML would make the next
-- fetch insert it again as unread. So ingestion records which entries the
-- last full fetch contained, and only entries that have left the feed are
-- ever pruned.

-- When the entry was last present in its feed (set on every upsert).
alter table public.entries
  add column last_seen_at timestamptz not null default now();

-- When the feed was last fetched in full (200 and parsed, not 304). Entries
-- with last_seen_at earlier than this are no longer in the feed.
alter table public.feeds
  add column last_parsed_at timestamptz;

-- Existing feeds: treat the last success as the last full fetch. Existing
-- entries default to "seen now", so nothing is prunable until the next full
-- fetch shows what the feed really contains.
update public.feeds set last_parsed_at = last_succeeded_at;

-- Bookkeeping must not count as a change to the entry.
drop trigger entries_set_updated_at on public.entries;
create trigger entries_set_updated_at
before update on public.entries
for each row execute function public.set_updated_at('sort_at', 'last_seen_at');

-- Deletes entries that have left their feed and are old enough:
--   read and first seen more than p_read_days ago, or
--   unread and first seen more than p_unread_days ago.
-- Starred entries are never deleted. Returns the number deleted.
-- Ingestion-only: callable by the service role, not by users.
create function public.prune_entries(p_read_days integer, p_unread_days integer)
returns integer
language sql
volatile
set search_path = ''
as $$
  with deleted as (
    delete from public.entries e
    using public.feeds f
    where f.id = e.feed_id
      and f.last_parsed_at is not null
      and e.last_seen_at < f.last_parsed_at
      and not exists (
        select 1 from public.entry_states s
        where s.entry_id = e.id and s.starred_at is not null
      )
      and (
        e.created_at < now() - make_interval(days => p_unread_days)
        or (
          e.created_at < now() - make_interval(days => p_read_days)
          and exists (
            select 1 from public.entry_states s
            where s.entry_id = e.id and s.read_at is not null
          )
        )
      )
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke execute on function public.prune_entries(integer, integer) from public, anon, authenticated;
grant execute on function public.prune_entries(integer, integer) to service_role;
