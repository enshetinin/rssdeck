# RSSDeck

A private, self-hostable RSS/Atom dashboard built with Next.js, Supabase and Render.

> Status: project foundation. Feed fetching, parsing and the reading UI are not implemented yet.

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

The local seed creates a fictional user, `dev@example.com` / `rssdeck-local-dev`, with one sample feed.

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

- `feeds`: a user's subscriptions, with HTTP cache validators and fetch scheduling.
- `entries`: items ingested from feeds, unique per `(feed_id, external_id)`; written only by the ingestion job.
- `entry_states`: per-user read and starred timestamps.

RLS limits every authenticated user to their own feeds, the entries of those feeds, and their own entry state. Column-level grants stop users from editing ingestion bookkeeping (ETag, schedule, errors). `anon` has no access.

## Project structure

```
src/
  app/              routes and layouts
  components/       reusable presentation components
  features/         domain-oriented application functionality
  lib/rss/          feed fetching, parsing and normalization (no persistence)
  lib/supabase/     browser, server and service-role clients
  styles/yev/       vendored yev-design foundations (do not edit)
  types/            generated database types
  proxy.ts          session refresh
scripts/            background jobs (feed ingestion)
supabase/           config, migrations, seed, pgTAP tests
tests/              unit and end-to-end tests
```

## Deployment (Render)

- Web service: `npm ci && npm run build`, start with `npm run start`.
- Cron job: `npm ci`, command `npm run ingest`.
- Configure environment variables in Render. `SUPABASE_SERVICE_ROLE_KEY` belongs only to the cron job.
- Apply migrations to the hosted project with `npx supabase link` and `npx supabase db push`.

## Security

This repository is public. Never commit credentials, tokens, `.env` files with real values, or production data. Only placeholders belong in `.env.example`. CI scans the full history with gitleaks.

## License

MIT
