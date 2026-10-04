-- Manual refresh: feeds are refreshed when their owner asks, from the web app,
-- as that user. There is no scheduled job and no service role in the app.
--
-- Users still get no direct write access to entries or to ingestion
-- bookkeeping on feeds. These SECURITY DEFINER functions are the only write
-- path: each acts on one feed of the caller (auth.uid()) and writes only the
-- columns ingestion writes. A user can therefore only ever alter entries and
-- bookkeeping of their own feeds.

-- Upserts entries into one of the caller's feeds. p_entries is a JSON array of
-- entries rows; only content columns and last_seen_at are taken from it.
create function public.save_own_feed_entries(p_feed_id uuid, p_entries jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.feeds f
    where f.id = p_feed_id and f.user_id = (select auth.uid())
  ) then
    raise exception 'Feed not found.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'Entries must be a JSON array.' using errcode = '22023';
  end if;

  -- Idempotent: re-ingesting the same entries updates them in place.
  insert into public.entries as e
    (feed_id, external_id, title, url, author, summary, content, published_at, last_seen_at)
  select
    p_feed_id, r.external_id, r.title, r.url, r.author, r.summary, r.content, r.published_at,
    coalesce(r.last_seen_at, now())
  from jsonb_populate_recordset(null::public.entries, p_entries) r
  on conflict (feed_id, external_id) do update set
    title = excluded.title,
    url = excluded.url,
    author = excluded.author,
    summary = excluded.summary,
    content = excluded.content,
    published_at = excluded.published_at,
    last_seen_at = excluded.last_seen_at;
end;
$$;

-- Records the outcome of fetching one of the caller's feeds. p_state is a
-- partial feeds row; keys it omits keep their current value, and only
-- ingestion bookkeeping and feed metadata can be set.
create function public.update_own_feed_state(p_feed_id uuid, p_state jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_state) is distinct from 'object' then
    raise exception 'State must be a JSON object.' using errcode = '22023';
  end if;

  update public.feeds f set
    (title, site_url, description, favicon_url, etag, last_modified, last_fetched_at,
     last_succeeded_at, last_parsed_at, last_error, consecutive_failure_count)
    = (
      select r.title, r.site_url, r.description, r.favicon_url, r.etag, r.last_modified,
        r.last_fetched_at, r.last_succeeded_at, r.last_parsed_at, r.last_error,
        r.consecutive_failure_count
      from jsonb_populate_record(f, p_state) r
    )
  where f.id = p_feed_id
    and f.user_id = (select auth.uid());

  if not found then
    raise exception 'Feed not found.' using errcode = '42501';
  end if;
end;
$$;

-- Retention, now run after each manual refresh and limited to the caller's
-- feeds. Same rules as the prune_entries it replaces: entries that have left
-- their feed are deleted once read and first seen more than p_read_days ago,
-- or unread and first seen more than p_unread_days ago; starred entries never.
drop function public.prune_entries(integer, integer);

create function public.prune_own_entries(p_read_days integer, p_unread_days integer)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.entries e
    using public.feeds f
    where f.id = e.feed_id
      and f.user_id = (select auth.uid())
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

revoke execute on function public.save_own_feed_entries(uuid, jsonb) from public, anon;
revoke execute on function public.update_own_feed_state(uuid, jsonb) from public, anon;
revoke execute on function public.prune_own_entries(integer, integer) from public, anon;
grant execute on function public.save_own_feed_entries(uuid, jsonb) to authenticated;
grant execute on function public.update_own_feed_state(uuid, jsonb) to authenticated;
grant execute on function public.prune_own_entries(integer, integer) to authenticated;
