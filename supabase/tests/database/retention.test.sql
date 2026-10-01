-- Entry retention (prune_entries). Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'alice@example.test');

-- One feed fetched in full just now; one never fetched in full.
insert into public.feeds (id, user_id, feed_url, last_parsed_at) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'https://a.example.test/feed', now()),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'https://b.example.test/feed', null);

-- "gone" entries were last seen before the last full fetch; "present" ones in it.
insert into public.entries (id, feed_id, external_id, created_at, last_seen_at) values
  ('00000000-0000-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'gone-read-40d',      now() - interval '40 days',  now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000002', 'aaaaaaaa-1111-4000-8000-000000000001', 'gone-read-10d',      now() - interval '10 days',  now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000003', 'aaaaaaaa-1111-4000-8000-000000000001', 'present-read-40d',   now() - interval '40 days',  now()),
  ('00000000-0000-4000-8000-000000000004', 'aaaaaaaa-1111-4000-8000-000000000001', 'gone-starred-400d',  now() - interval '400 days', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000005', 'aaaaaaaa-1111-4000-8000-000000000001', 'gone-unread-60d',    now() - interval '60 days',  now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000006', 'aaaaaaaa-1111-4000-8000-000000000001', 'gone-unread-100d',   now() - interval '100 days', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000007', 'aaaaaaaa-1111-4000-8000-000000000002', 'never-parsed-400d',  now() - interval '400 days', now() - interval '300 days');

insert into public.entry_states (user_id, entry_id, read_at, starred_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', now(), null),
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', now(), null),
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', now(), null),
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', now(), now());

-- Users cannot prune -----------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select throws_ok('select public.prune_entries(30, 90)', '42501', null, 'Users cannot call prune_entries');
reset role;

-- Pruning ----------------------------------------------------------------------

select is(public.prune_entries(30, 90), 2, 'Two entries are pruned');

select ok(not exists (select 1 from public.entries where external_id = 'gone-read-40d'),
  'A read entry that left the feed 30+ days after being seen is pruned');
select ok(not exists (select 1 from public.entries where external_id = 'gone-unread-100d'),
  'An unread entry that left the feed 90+ days after being seen is pruned');
select ok(exists (select 1 from public.entries where external_id = 'gone-read-10d'),
  'A recent read entry is kept');
select ok(exists (select 1 from public.entries where external_id = 'present-read-40d'),
  'An old entry still in the feed is kept (it would come back as new)');
select ok(exists (select 1 from public.entries where external_id = 'gone-starred-400d'),
  'A starred entry is never pruned');
select ok(exists (select 1 from public.entries where external_id = 'gone-unread-60d'),
  'An unread entry younger than the unread limit is kept');
select ok(exists (select 1 from public.entries where external_id = 'never-parsed-400d'),
  'Entries of a feed never fetched in full are kept');

select is(public.prune_entries(30, 90), 0, 'Pruning again changes nothing');

-- Bookkeeping ------------------------------------------------------------------

alter table public.entries disable trigger entries_set_updated_at;
update public.entries set updated_at = '2000-01-01' where external_id = 'gone-read-10d';
alter table public.entries enable trigger entries_set_updated_at;
update public.entries set last_seen_at = now() where external_id = 'gone-read-10d';

select is(
  (select updated_at from public.entries where external_id = 'gone-read-10d'),
  '2000-01-01'::timestamptz,
  'Recording last_seen_at does not count as a change to the entry'
);

select * from finish();
rollback;
