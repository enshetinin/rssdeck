-- Reading view and state functions. Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'alice@example.test'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'bob@example.test');

insert into public.feeds (id, user_id, feed_url) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'https://alice.example.test/feed'),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'https://bob.example.test/feed');

insert into public.entries (id, feed_id, external_id, published_at) values
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'a1', now() - interval '2 days'),
  ('aaaaaaaa-2222-4000-8000-000000000002', 'aaaaaaaa-1111-4000-8000-000000000001', 'a2', now() + interval '30 days'),
  ('bbbbbbbb-2222-4000-8000-000000000003', 'bbbbbbbb-1111-4000-8000-000000000002', 'b1', now());

-- Bob has read his own entry.
insert into public.entry_states (user_id, entry_id, read_at) values
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-2222-4000-8000-000000000003', now());

select is(
  (select sort_at from public.entries where id = 'aaaaaaaa-2222-4000-8000-000000000002'),
  (select created_at from public.entries where id = 'aaaaaaaa-2222-4000-8000-000000000002'),
  'A future publication date sorts at the time the entry was first seen'
);

set local role anon;
select throws_ok('select * from public.entry_list', '42501', null, 'anon cannot read entry_list');
select throws_ok('select public.entry_counts()', '42501', null, 'anon cannot call entry_counts');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

select results_eq(
  'select id from public.entry_list order by sort_at desc',
  $$values ('aaaaaaaa-2222-4000-8000-000000000002'::uuid), ('aaaaaaaa-2222-4000-8000-000000000001'::uuid)$$,
  'Alice sees only her entries, newest first'
);

select is(
  (select count(*)::int from public.entry_list where is_read),
  0,
  'Bob''s read state does not leak into Alice''s view'
);

select results_eq(
  'select feed_id, total, unread, starred from public.entry_counts()',
  $$values ('aaaaaaaa-1111-4000-8000-000000000001'::uuid, 2::bigint, 2::bigint, 0::bigint)$$,
  'entry_counts covers only Alice''s feeds'
);

select lives_ok(
  $$select public.set_entry_state('aaaaaaaa-2222-4000-8000-000000000001', p_starred => true)$$,
  'Alice can star her entry'
);

select lives_ok(
  $$select public.set_entry_state('aaaaaaaa-2222-4000-8000-000000000001', p_read => true)$$,
  'Alice can mark it read without unstarring it'
);

select results_eq(
  $$select is_read, is_starred from public.entry_list where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$,
  $$values (true, true)$$,
  'Both flags are set'
);

select lives_ok(
  $$select public.set_entry_state('aaaaaaaa-2222-4000-8000-000000000001', p_read => false)$$,
  'Alice can mark it unread again'
);

select throws_ok(
  $$select public.set_entry_state('bbbbbbbb-2222-4000-8000-000000000003', p_starred => true)$$,
  '42501', null,
  'Alice cannot set state on Bob''s entry'
);

select is(
  public.mark_entries_read(),
  2,
  'mark_entries_read marks all of Alice''s unread entries'
);

reset role;

select is(
  (select read_at is not null from public.entry_states
   where user_id = 'bbbbbbbb-0000-4000-8000-000000000002'
     and entry_id = 'bbbbbbbb-2222-4000-8000-000000000003'),
  true,
  'Bob''s state is untouched'
);

select * from finish();
rollback;
