-- Write path of the manual refresh (save_own_feed_entries, update_own_feed_state).
-- Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'alice@example.test'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'bob@example.test');

insert into public.feeds (id, user_id, feed_url, title) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'https://alice.example.test/feed', null),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'https://bob.example.test/feed', 'Bob');

-- Anonymous ----------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$select public.save_own_feed_entries('aaaaaaaa-1111-4000-8000-000000000001', '[]')$$,
  '42501', null,
  'anon cannot save entries'
);

select throws_ok(
  $$select public.update_own_feed_state('aaaaaaaa-1111-4000-8000-000000000001', '{}')$$,
  '42501', null,
  'anon cannot update feed state'
);

-- Authenticated as Alice -----------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

select lives_ok(
  $$select public.save_own_feed_entries('aaaaaaaa-1111-4000-8000-000000000001',
    '[{"external_id": "1", "title": "First", "last_seen_at": "2026-10-01T12:00:00Z"},
      {"external_id": "2", "title": "Second"}]')$$,
  'Alice can save entries into her own feed'
);

select results_eq(
  'select external_id, title from public.entries order by external_id',
  $$values ('1', 'First'), ('2', 'Second')$$,
  'The entries are stored'
);

select lives_ok(
  $$select public.save_own_feed_entries('aaaaaaaa-1111-4000-8000-000000000001',
    '[{"external_id": "1", "title": "First, edited", "last_seen_at": "2026-10-02T12:00:00Z"}]')$$,
  'Saving an entry again updates it'
);

select results_eq(
  $$select count(*)::integer, max(title), max(last_seen_at) from public.entries where external_id = '1'$$,
  $$values (1, 'First, edited', '2026-10-02T12:00:00Z'::timestamptz)$$,
  'Re-saving is idempotent: one row, new content and last_seen_at'
);

select lives_ok(
  $$select public.save_own_feed_entries('aaaaaaaa-1111-4000-8000-000000000001',
    '[{"external_id": "3", "feed_id": "bbbbbbbb-1111-4000-8000-000000000002", "id": "00000000-0000-4000-8000-000000000099"}]')$$,
  'Columns other than content are ignored'
);

select is(
  (select feed_id from public.entries where external_id = '3'),
  'aaaaaaaa-1111-4000-8000-000000000001'::uuid,
  'An entry cannot be redirected into another feed'
);

select throws_ok(
  $$select public.save_own_feed_entries('bbbbbbbb-1111-4000-8000-000000000002', '[{"external_id": "x"}]')$$,
  '42501', null,
  'Alice cannot save entries into Bob''s feed'
);

select throws_ok(
  $$select public.save_own_feed_entries('aaaaaaaa-1111-4000-8000-000000000001', '{"external_id": "x"}')$$,
  '22023', null,
  'Entries must be an array'
);

select lives_ok(
  $$select public.update_own_feed_state('aaaaaaaa-1111-4000-8000-000000000001',
    '{"etag": "\"v2\"", "last_error": "HTTP 500.", "consecutive_failure_count": 3, "title": "Alice"}')$$,
  'Alice can record a fetch of her own feed'
);

select results_eq(
  $$select etag, last_error, consecutive_failure_count, title, feed_url from public.feeds
    where id = 'aaaaaaaa-1111-4000-8000-000000000001'$$,
  $$values ('"v2"', 'HTTP 500.', 3, 'Alice', 'https://alice.example.test/feed')$$,
  'Given keys are set; others, like feed_url, are kept'
);

select lives_ok(
  $$select public.update_own_feed_state('aaaaaaaa-1111-4000-8000-000000000001',
    '{"feed_url": "https://elsewhere.example.test/", "user_id": "bbbbbbbb-0000-4000-8000-000000000002"}')$$,
  'Keys outside ingestion bookkeeping are accepted but ignored'
);

select results_eq(
  $$select feed_url, user_id from public.feeds where id = 'aaaaaaaa-1111-4000-8000-000000000001'$$,
  $$values ('https://alice.example.test/feed', 'aaaaaaaa-0000-4000-8000-000000000001'::uuid)$$,
  'Neither the address nor the owner can be changed this way'
);

select throws_ok(
  $$select public.update_own_feed_state('bbbbbbbb-1111-4000-8000-000000000002', '{"last_error": "forged"}')$$,
  '42501', null,
  'Alice cannot update Bob''s feed state'
);

select * from finish();
rollback;
