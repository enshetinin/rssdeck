-- RLS and privilege tests. Run with `npm run test:db` against the local stack.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- Fixtures (as the migration owner, bypassing RLS) -------------------------

insert into auth.users (id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'alice@example.test'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'bob@example.test');

insert into public.feeds (id, user_id, feed_url) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'https://alice.example.test/feed'),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'https://bob.example.test/feed');

insert into public.entries (id, feed_id, external_id) values
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'alice-1'),
  ('bbbbbbbb-2222-4000-8000-000000000002', 'bbbbbbbb-1111-4000-8000-000000000002', 'bob-1');

insert into public.entry_states (user_id, entry_id, read_at) values
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-2222-4000-8000-000000000002', now());

-- Anonymous ----------------------------------------------------------------

set local role anon;

select throws_ok(
  'select * from public.feeds',
  '42501', null,
  'anon cannot read feeds'
);

-- Authenticated as Alice ---------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

select results_eq(
  'select id from public.feeds',
  $$values ('aaaaaaaa-1111-4000-8000-000000000001'::uuid)$$,
  'Alice sees only her own feeds'
);

select results_eq(
  'select id from public.entries',
  $$values ('aaaaaaaa-2222-4000-8000-000000000001'::uuid)$$,
  'Alice sees only entries of her own feeds'
);

select is_empty(
  'select * from public.entry_states',
  'Alice cannot see Bob''s entry state'
);

select lives_ok(
  $$insert into public.feeds (feed_url) values ('https://alice.example.test/other')$$,
  'Alice can add a feed; ownership defaults to her'
);

select is(
  (select user_id from public.feeds where feed_url = 'https://alice.example.test/other'),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  'New feed is owned by Alice'
);

select throws_ok(
  $$insert into public.feeds (user_id, feed_url) values ('bbbbbbbb-0000-4000-8000-000000000002', 'https://x.example.test/feed')$$,
  '42501', null,
  'Alice cannot create a feed for Bob'
);

select throws_ok(
  $$update public.feeds set etag = 'forged' where id = 'aaaaaaaa-1111-4000-8000-000000000001'$$,
  '42501', null,
  'Alice cannot overwrite ingestion bookkeeping'
);

select is_empty(
  $$update public.feeds set title = 'hijacked' where id = 'bbbbbbbb-1111-4000-8000-000000000002' returning id$$,
  'Alice cannot update Bob''s feed'
);

select is_empty(
  $$delete from public.feeds where id = 'bbbbbbbb-1111-4000-8000-000000000002' returning id$$,
  'Alice cannot delete Bob''s feed'
);

select throws_ok(
  $$insert into public.entries (feed_id, external_id) values ('aaaaaaaa-1111-4000-8000-000000000001', 'forged')$$,
  '42501', null,
  'Alice cannot write entries directly'
);

select lives_ok(
  $$insert into public.entry_states (entry_id, starred_at) values ('aaaaaaaa-2222-4000-8000-000000000001', now())$$,
  'Alice can star her own entry'
);

select throws_ok(
  $$insert into public.entry_states (entry_id, read_at) values ('bbbbbbbb-2222-4000-8000-000000000002', now())$$,
  '42501', null,
  'Alice cannot attach state to Bob''s entry'
);

select is_empty(
  $$update public.entry_states set read_at = null where user_id = 'bbbbbbbb-0000-4000-8000-000000000002' returning entry_id$$,
  'Alice cannot modify Bob''s entry state'
);

-- Constraints --------------------------------------------------------------

reset role;

select throws_ok(
  $$insert into public.entries (feed_id, external_id) values ('aaaaaaaa-1111-4000-8000-000000000001', 'alice-1')$$,
  '23505', null,
  'Duplicate external_id within a feed is rejected'
);

select lives_ok(
  $$insert into public.entries (feed_id, external_id) values ('bbbbbbbb-1111-4000-8000-000000000002', 'alice-1')$$,
  'The same external_id may exist in a different feed'
);

select throws_ok(
  $$insert into public.feeds (user_id, feed_url) values ('aaaaaaaa-0000-4000-8000-000000000001', 'file:///etc/passwd')$$,
  '23514', null,
  'Only http(s) feed URLs are accepted'
);

select * from finish();
rollback;
