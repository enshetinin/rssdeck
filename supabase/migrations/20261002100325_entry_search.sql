-- Full-text search over entries.

-- Feeds mix languages, so no stemming: the "simple" parser, lowercased and
-- with accents removed, so "arbol" finds "árbol" and the other way round.
create extension if not exists unaccent with schema extensions;

create text search configuration public.entry_search (copy = pg_catalog.simple);
alter text search configuration public.entry_search
  alter mapping for hword, hword_part, word with extensions.unaccent, pg_catalog.simple;

-- Title, author and body as plain text. Tags and character references are
-- dropped so markup is not indexed; the body is capped before any processing
-- so one huge entry cannot exceed the tsvector size limit and fail ingestion.
alter table public.entries
  add column search tsvector generated always as (
    -- || rather than concat_ws: generated columns need immutable functions.
    to_tsvector(
      'public.entry_search'::regconfig,
      coalesce(title, '') || ' ' || coalesce(author, '') || ' ' ||
      regexp_replace(
        left(coalesce(content, summary, ''), 200000),
        '<[^>]*>|&#?[a-z0-9]+;',
        ' ',
        'gi'
      )
    )
  ) stored;

create index entries_search_idx on public.entries using gin (search);

-- Stored generated columns are NULL in a BEFORE trigger's NEW; ignore it like
-- sort_at (see set_updated_at).
drop trigger entries_set_updated_at on public.entries;
create trigger entries_set_updated_at
before update on public.entries
for each row execute function public.set_updated_at('sort_at', 'last_seen_at', 'search');

-- Expose the vector through the reader's view so searches reuse its filters,
-- ordering and RLS. Columns can only be appended, so the rest is unchanged.
create or replace view public.entry_list
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
  left(coalesce(e.summary, e.content), 600) as excerpt_source,
  e.published_at,
  e.sort_at,
  s.read_at is not null as is_read,
  s.starred_at is not null as is_starred,
  s.starred_at,
  e.search
from public.entries e
join public.feeds f on f.id = e.feed_id
left join public.entry_states s
  on s.entry_id = e.id
  and s.user_id = (select auth.uid());
