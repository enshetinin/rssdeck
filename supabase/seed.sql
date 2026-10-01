-- Local development seed. Applied by `supabase db reset` against the LOCAL
-- stack only; never run this against production.
--
-- Everything here is fictional. Sign in locally with:
--   email:    dev@example.com
--   password: rssdeck-local-dev

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'dev@example.com',
  extensions.crypt('rssdeck-local-dev', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  now(),
  now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  '11111111-1111-4111-8111-111111111112',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '{"sub": "11111111-1111-4111-8111-111111111111", "email": "dev@example.com", "email_verified": true}',
  'email',
  now(),
  now(),
  now()
);

insert into public.feeds (id, user_id, feed_url, title, site_url, description) values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'https://example.com/feed.xml',
  'Example Feed',
  'https://example.com/',
  'A fictional feed for local development.'
);

insert into public.entries (feed_id, external_id, title, url, author, summary, published_at) values
  (
    '22222222-2222-4222-8222-222222222222',
    'https://example.com/posts/hello',
    'Hello, RSSDeck',
    'https://example.com/posts/hello',
    'Example Author',
    '<p>A short, fictional summary.</p>',
    now() - interval '1 day'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'https://example.com/posts/untrusted-html',
    'Untrusted HTML sample',
    'https://example.com/posts/untrusted-html',
    null,
    '<p onclick="alert(1)">Feed HTML is untrusted.</p><script>alert(1)</script>',
    now() - interval '2 hours'
  );
