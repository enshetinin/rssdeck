-- Ingestion bookkeeping.

-- Consecutive failed fetches, used to back off broken feeds. Reset on success.
-- Not granted to authenticated: only the ingestion job writes it.
alter table public.feeds
  add column consecutive_failure_count integer not null default 0
  constraint feeds_consecutive_failure_count_nonnegative check (consecutive_failure_count >= 0);

-- Ingestion re-upserts every entry on each fetch. Only bump updated_at when
-- something actually changed, so it stays meaningful.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new is distinct from old then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
