-- Full-text search over entries. Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'alice@example.test'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'bob@example.test');

insert into public.feeds (id, user_id, feed_url) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'https://alice.example.test/feed'),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'https://bob.example.test/feed');

insert into public.entries (id, feed_id, external_id, title, author, content) values
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'a1',
   'Running Kubernetes at home', 'Ana', '<p class="lede">An <em>árbol</em> of pods &amp; nodes</p>'),
  ('aaaaaaaa-2222-4000-8000-000000000002', 'aaaaaaaa-1111-4000-8000-000000000001', 'a2',
   'Bread', null, '<p>Sourdough notes</p>'),
  ('bbbbbbbb-2222-4000-8000-000000000003', 'bbbbbbbb-1111-4000-8000-000000000002', 'b1',
   'Kubernetes for Bob', null, null);

select is(
  (select count(*)::int from public.entries
   where search @@ to_tsquery('public.entry_search', 'class:* | lede:* | amp:*')),
  0,
  'Markup and character references are not indexed'
);

-- Bookkeeping updates must not look like edits.
update public.entries set last_seen_at = now() + interval '1 hour'
where id = 'aaaaaaaa-2222-4000-8000-000000000001';
select is(
  (select updated_at = created_at from public.entries where id = 'aaaaaaaa-2222-4000-8000-000000000001'),
  true,
  'The generated search column does not bump updated_at'
);

set local role anon;
select throws_ok(
  $$select id from public.entry_list where search @@ to_tsquery('public.entry_search', 'kube:*')$$,
  '42501', null, 'anon cannot search'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

select results_eq(
  $$select id from public.entry_list where search @@ to_tsquery('public.entry_search', 'kube:*')$$,
  $$values ('aaaaaaaa-2222-4000-8000-000000000001'::uuid)$$,
  'A prefix matches, and only within the caller''s own entries'
);

select results_eq(
  $$select id from public.entry_list where search @@ to_tsquery('public.entry_search', 'ARBOL:*')$$,
  $$values ('aaaaaaaa-2222-4000-8000-000000000001'::uuid)$$,
  'Matching ignores case and accents'
);

select results_eq(
  $$select id from public.entry_list where search @@ to_tsquery('public.entry_search', 'ana:*')$$,
  $$values ('aaaaaaaa-2222-4000-8000-000000000001'::uuid)$$,
  'The author is searchable'
);

select is_empty(
  $$select id from public.entry_list where search @@ to_tsquery('public.entry_search', 'kube:* & sourdough:*')$$,
  'Every term must match'
);

select is_empty(
  $$select id from public.entry_list where search @@ to_tsquery('public.entry_search', 'bob:*')$$,
  'Another user''s entries are never found'
);

select * from finish();
rollback;
