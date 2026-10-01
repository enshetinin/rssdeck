# RSSDeck

A private, self-hostable RSS/Atom dashboard built with Next.js, Supabase and Render.

> Status: usable. Sign-in, a three-column reader, feed management and scheduled ingestion work.

## Stack

- Next.js (App Router), React, TypeScript (strict)
- Supabase: PostgreSQL, Auth, Row Level Security
- Render: web service and a cron job for feed ingestion
- npm, ESLint, Prettier, Vitest, Playwright, pgTAP

## Local development

Requirements: Node.js 24 (see `.nvmrc`) and Docker (running).

```bash
git clone <repo-url> rssdeck && cd rssdeck
npm ci
npm run supabase:start        # local Postgres, Auth and APIs; applies migrations + seed
cp .env.example .env.local    # then fill in values from `npm run supabase:status`
npm run dev                   # http://localhost:3000
```

`.env.local` values from `npm run supabase:status`:

| Variable                               | Status output                          |
| -------------------------------------- | -------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | API URL                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key                        |
| `SUPABASE_SERVICE_ROLE_KEY`            | Secret key (only for `npm run ingest`) |

The local seed creates a fictional user, `dev@example.com` / `rssdeck-local-dev`, with one sample feed. Sign in at http://localhost:3000/login.

## Accounts

RSSDeck is private: there is no sign-up page. Sign-in uses Supabase Auth with email and password, and every page except `/login` requires a session.

In production, create users in the Supabase dashboard (Authentication → Users → Add user) and turn off public sign-ups (Authentication → Sign In / Providers → "Allow new users to sign up").

## Common tasks

| Command                              | Purpose                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| `npm run check`                      | Lint, format check, typecheck, unit tests, build         |
| `npm test` / `npm run test:e2e`      | Vitest unit tests / Playwright end-to-end tests          |
| `npm run test:db`                    | pgTAP tests for RLS and constraints (local stack)        |
| `npm run db:migration:new -- <name>` | Create a new migration                                   |
| `npm run db:reset`                   | Rebuild the local database from migrations and seed      |
| `npm run db:types`                   | Regenerate `src/types/database.ts` from the local schema |
| `npm run ingest`                     | Run the ingestion job against the configured Supabase    |
| `npm run secrets:scan`               | Scan git history for secrets with gitleaks (Docker)      |

First-time Playwright setup: `npx playwright install chromium`.

## Database

The schema lives exclusively in `supabase/migrations/`. Every change is a new migration, followed by `npm run db:types`.

- `feeds`: a user's subscriptions, with HTTP cache validators, fetch scheduling and failure backoff.
- `entries`: items ingested from feeds, unique per `(feed_id, external_id)`; written only by the ingestion job.
- `entry_states`: per-user read and starred timestamps.
- `entry_list` (view, `security_invoker`): entries joined with the caller's own state; `entry_counts()`, `set_entry_state()` and `mark_entries_read()` run as the caller, so RLS applies.

RLS limits every authenticated user to their own feeds, the entries of those feeds, and their own entry state. Column-level grants stop users from editing ingestion bookkeeping (ETag, schedule, errors). `anon` has no access.

## Reading

The app is a three-column reader: feeds and views (All, Unread, Starred) with counts on the left, the entry list in the middle, the open entry on the right. Narrower screens show one pane at a time. The view lives in the URL (`/?filter=unread&feed=…&entry=…`), so every state is linkable.

Opening an entry marks it read; entries can be starred, marked unread, and a feed (or everything) marked as read after confirming. Feed HTML is sanitized on the server with an allowlist (`src/lib/html/sanitize-feed-html.ts`) before it is rendered: no scripts, styles, frames, forms or event handlers; links open in a new tab without a referrer.

The sidebar has a System / Light / Dark theme switch (kept in a cookie, so the page renders in the right theme without a flash), and the tab title shows the unread count.

Keyboard shortcuts: `j` / `k` next and previous entry, `s` star, `m` read/unread, `o` open the original, `?` help. They can be turned off in the help dialog (also reachable from "Keyboard shortcuts" in the sidebar), and are ignored while typing in a field.

## Feeds

At `/feeds` ("Manage feeds") a user adds a feed by its address or by a website address (the page's `<link rel="alternate">` feeds are discovered; everything is fetched through the same network guard as ingestion), sees each feed's last refresh or error and refresh interval, renames a feed or changes how often it is refreshed, and removes feeds after confirming. New feeds get their entries on the next ingestion run.

Subscriptions can be imported from and exported to OPML, the format other readers use. Imports are capped at 500 feeds and 512 KB, folders are flattened, and imported feeds are not fetched on the spot: ingestion checks them and reports broken ones.

## Feed ingestion

`npm run ingest` processes every feed whose `next_fetch_at` has passed:

1. Fetch with a 15 s timeout, a 5 MB limit, `If-None-Match` / `If-Modified-Since`, and redirects followed manually (max 5).
2. Refuse hosts that resolve to private, loopback or link-local addresses, so feed URLs cannot reach internal services.
3. Parse RSS 2.0, RSS 1.0 or Atom into `src/lib/rss/types.ts`, keeping only http(s) links.
4. Upsert entries on `(feed_id, external_id)`, so re-running is idempotent.
5. Schedule the next fetch: the refresh interval on success, exponential backoff (max 24 h) on failure.

6. Prune old entries that have left their feeds: read ones 30 days and unread ones 90 days after they were first seen. Starred entries are never pruned, and an entry still in the feed is never pruned (it would come back as new on the next fetch). The policy lives in `src/features/ingestion/retention.ts`.

A broken feed records a short `last_error` (never its URL, which may contain tokens) and never stops the run. Feed HTML is stored as received; it must be sanitized before rendering.

## Project structure

```
src/
  app/              routes and layouts
  components/       reusable presentation components
  features/         domain-oriented functionality (auth/, entries/, feeds/, ingestion/)
  lib/html/         sanitization of feed HTML for rendering
  lib/rss/          feed fetching, parsing and normalization (no persistence)
  lib/supabase/     browser, server and service-role clients
  styles/yev/       vendored yev-design foundations (do not edit)
  types/            generated database types
  proxy.ts          session refresh
scripts/            background jobs (feed ingestion)
supabase/           config, migrations, seed, pgTAP tests
tests/              unit and end-to-end tests
```

## Deployment

Supabase (database and auth) plus Render (web service and ingestion cron), described in `render.yaml`. Step-by-step guide: [docs/deployment.md](docs/deployment.md).

## Security

Dependabot (`.github/dependabot.yml`) opens weekly pull requests for npm and GitHub Actions updates; also enable Dependabot security updates under Settings → Code security.

This repository is public. Never commit credentials, tokens, `.env` files with real values, or production data. Only placeholders belong in `.env.example`. CI scans the full history with gitleaks.

## License

MIT
