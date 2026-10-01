-- Initial RSSDeck schema: feeds, entries and per-user entry state.
--
-- Access model
--   * feeds and entry_states are owned by a user and protected by RLS.
--   * entries are written only by the ingestion job (service role, which
--     bypasses RLS) and are readable by the owner of the parent feed.
--   * Table privileges are granted explicitly per column, so authenticated
--     users cannot overwrite ingestion bookkeeping (ETag, next_fetch_at, ...)
--     even on rows they own. anon gets nothing.

-- Shared trigger function --------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- feeds --------------------------------------------------------------------

create table public.feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feed_url text not null,
  title text,
  site_url text,
  description text,
  favicon_url text,
  -- HTTP cache validators from the last successful fetch, sent back as
  -- If-None-Match / If-Modified-Since.
  etag text,
  last_modified text,
  refresh_interval_minutes integer not null default 60,
  next_fetch_at timestamptz not null default now(),
  last_fetched_at timestamptz,
  last_succeeded_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint feeds_user_feed_url_key unique (user_id, feed_url),
  constraint feeds_feed_url_http check (feed_url ~* '^https?://' and char_length(feed_url) <= 2048),
  constraint feeds_refresh_interval_range check (refresh_interval_minutes between 5 and 10080),
  constraint feeds_last_error_length check (char_length(last_error) <= 2000)
);

comment on table public.feeds is 'RSS/Atom subscriptions, one row per user and feed URL.';

-- The ingestion job selects feeds that are due: where next_fetch_at <= now().
create index feeds_next_fetch_at_idx on public.feeds (next_fetch_at);

create trigger feeds_set_updated_at
before update on public.feeds
for each row execute function public.set_updated_at();

-- entries ------------------------------------------------------------------

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.feeds (id) on delete cascade,
  -- Stable identity within a feed (RSS guid, Atom id, or a derived fallback).
  -- Upserts on (feed_id, external_id) keep ingestion idempotent.
  external_id text not null,
  title text,
  url text,
  author text,
  -- Raw feed-provided text/HTML. Untrusted: sanitize before rendering.
  summary text,
  content text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint entries_feed_external_id_key unique (feed_id, external_id),
  constraint entries_external_id_not_blank check (char_length(external_id) between 1 and 2048)
);

comment on table public.entries is 'Items ingested from feeds. Written by the ingestion job only.';
comment on column public.entries.summary is 'Untrusted feed HTML/text. Never render without sanitization.';
comment on column public.entries.content is 'Untrusted feed HTML/text. Never render without sanitization.';

-- Newest-first timelines, per feed and merged across a user's feeds.
create index entries_feed_published_at_idx on public.entries (feed_id, published_at desc nulls last, id);

create trigger entries_set_updated_at
before update on public.entries
for each row execute function public.set_updated_at();

-- entry_states -------------------------------------------------------------

create table public.entry_states (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  read_at timestamptz,
  starred_at timestamptz,

  primary key (user_id, entry_id)
);

comment on table public.entry_states is 'Per-user read/starred state. A missing row means unread and not starred.';

-- Supports cascading deletes from entries.
create index entry_states_entry_id_idx on public.entry_states (entry_id);
-- "Starred" view, newest star first.
create index entry_states_starred_idx on public.entry_states (user_id, starred_at desc)
  where starred_at is not null;

-- Privileges ---------------------------------------------------------------

revoke all on table public.feeds, public.entries, public.entry_states from anon, authenticated;

grant select, delete on table public.feeds to authenticated;
grant insert (feed_url, title, refresh_interval_minutes) on table public.feeds to authenticated;
grant update (title, refresh_interval_minutes) on table public.feeds to authenticated;

grant select on table public.entries to authenticated;

grant select, delete on table public.entry_states to authenticated;
grant insert (entry_id, read_at, starred_at) on table public.entry_states to authenticated;
grant update (read_at, starred_at) on table public.entry_states to authenticated;

grant all on table public.feeds, public.entries, public.entry_states to service_role;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Row Level Security -------------------------------------------------------

alter table public.feeds enable row level security;
alter table public.entries enable row level security;
alter table public.entry_states enable row level security;

-- `(select auth.uid())` is evaluated once per statement instead of per row.

create policy "Users can read their own feeds"
on public.feeds for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can add feeds for themselves"
on public.feeds for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own feeds"
on public.feeds for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their own feeds"
on public.feeds for delete to authenticated
using (user_id = (select auth.uid()));

create policy "Users can read entries of their own feeds"
on public.entries for select to authenticated
using (
  exists (
    select 1
    from public.feeds f
    where f.id = entries.feed_id
      and f.user_id = (select auth.uid())
  )
);

create policy "Users can read their own entry state"
on public.entry_states for select to authenticated
using (user_id = (select auth.uid()));

-- State may only be attached to entries the user can see.
create policy "Users can add state to their own entries"
on public.entry_states for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.entries e
    join public.feeds f on f.id = e.feed_id
    where e.id = entry_states.entry_id
      and f.user_id = (select auth.uid())
  )
);

create policy "Users can update their own entry state"
on public.entry_states for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their own entry state"
on public.entry_states for delete to authenticated
using (user_id = (select auth.uid()));
