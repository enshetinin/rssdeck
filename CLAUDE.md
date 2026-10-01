# RSSDeck

RSSDeck is a private, self-hostable RSS/Atom dashboard.

The repository is public. Treat all code, configuration, commit history, logs, fixtures, screenshots, and documentation as publicly visible.

## Tech stack

- TypeScript
- Next.js with App Router
- React
- Supabase PostgreSQL
- Supabase Auth
- Supabase Row Level Security
- Supabase CLI for local development
- Render for production hosting and scheduled RSS ingestion
- npm as package manager
- ESLint + Prettier, Vitest (unit), Playwright (end-to-end), pgTAP (database/RLS)

Prefer the existing stack. Do not introduce new frameworks, databases, ORMs, state managers, UI libraries, or infrastructure without a concrete need.

## Package manager

Use `npm` only. Do not use pnpm, yarn or bun. `package-lock.json` is committed; CI installs with `npm ci`.

Dependency install scripts are blocked by default (npm `allowScripts` in `package.json`). Approve one only after reviewing why it needs to run.

Common commands:

```bash
npm install
npm run dev
npm run lint
npm run format
npm run typecheck
npm test               # Vitest unit tests
npm run test:e2e       # Playwright
npm run test:db        # pgTAP RLS tests against local Supabase
npm run build
npm run check          # lint + format check + typecheck + unit tests + build
```

## Design system

The `yev-design` skill is the authoritative design system for RSSDeck.

Whenever creating or modifying UI:

1. Use the `yev-design` skill before implementing the UI.
2. Follow its tokens, typography, spacing, component patterns, interaction patterns, responsive behavior, and accessibility guidance.
3. Prefer existing yev-design components and patterns over inventing new ones.
4. Do not introduce another design system or component library that conflicts with yev-design.
5. Do not approximate or independently reinterpret yev-design when the skill provides an explicit pattern.
6. If the skill is unavailable, do not invent a replacement design language. Continue only with non-design work and report that the skill could not be loaded.

RSSDeck uses the **application / operational** dialect.

The yev-design foundations are vendored verbatim in `src/styles/yev/` (cascade layers `yev.*`). Do not edit them; project rules go in `src/app/globals.css`, which is unlayered and overrides them. No Tailwind or component libraries.

UI implementation must remain consistent with yev-design across desktop and mobile.

## Architecture

Keep responsibilities separated.

- `src/app/`: routing, layouts and Next.js entry points.
- `src/components/`: reusable presentation components.
- `src/features/`: domain-oriented application functionality.
- `src/lib/rss/`: RSS fetching, parsing and normalization.
- `src/lib/supabase/`: Supabase clients and database integration.
- `src/types/database.ts`: generated Supabase types. Never edit by hand.
- `src/proxy.ts`: Next.js proxy (formerly middleware) that refreshes the Supabase session.
- `scripts/`: executable background/maintenance processes.
- `supabase/`: database schema, migrations, seed data, pgTAP tests and local Supabase configuration.
- `tests/unit/`, `tests/e2e/`: Vitest and Playwright tests.

Business logic should not live directly in React components.

RSS parsing must remain independent from the persistence layer.

Database access must remain independent from RSS parsing.

## Database

Production uses Supabase PostgreSQL.

Local development uses the Supabase CLI (installed as an npm devDependency; run via `npx supabase` or the npm scripts) and its Docker-based local stack: `npm run supabase:start`.

Migrations in `supabase/migrations/` are the single source of truth for the schema.

- Create a migration with `npm run db:migration:new -- <name>`; never edit a migration that has been applied anywhere shared.
- Apply locally with `npm run db:reset` (re-runs all migrations and `supabase/seed.sql`).
- After every schema change, run `npm run db:types` and commit `src/types/database.ts`. CI fails if it is stale.
- Never make an undocumented manual production schema change, including via the Supabase dashboard.
- `supabase/seed.sql` is local-only fictional data. Never put real data in it.

Use PostgreSQL features supported by Supabase.

Use Row Level Security for user-owned application data, and cover policies with pgTAP tests in `supabase/tests/database/`.

Table privileges are granted explicitly per column (`auto_expose_new_tables = false`). New tables must revoke defaults, grant only what is needed, enable RLS and add policies in the same migration. Do not weaken RLS or grants for convenience.

Never rely exclusively on frontend checks for authorization.

## Authentication

The private dashboard uses Supabase Auth.

Authenticated application requests use the user's Supabase session.

Server-side privileged operations may use the Supabase service role only where required.

The service-role credential must never be exposed to client-side code.

## Security

This is a public repository.

NEVER commit or expose:

- passwords
- API keys
- access tokens
- refresh tokens
- Supabase service-role keys
- production database URLs
- private Render credentials
- cookies or session tokens
- OAuth client secrets
- personal email addresses unless intentionally public
- production data
- private URLs containing credentials
- `.env` files containing real values

Never place secrets in:

- source code
- tests
- fixtures
- seed data
- documentation
- screenshots
- logs
- Git commits
- example curl commands

Only environment-variable names and clearly fake placeholder values belong in `.env.example`.

Before adding configuration, ask: "Would this be safe if indexed publicly by GitHub?"

If not, it must not be committed.

## Environment variables

Local secrets belong in `.env.local` or another gitignored local environment file.

Production secrets belong in the hosting provider's secret/environment configuration.

`.env.example` documents required variables but contains no real credentials.

Client-visible Next.js variables must use `NEXT_PUBLIC_` only when they are intentionally safe for browsers.

Never prefix server secrets with `NEXT_PUBLIC_`.

## Supabase clients

Maintain explicit separation between:

- browser client: `src/lib/supabase/client.ts`
- authenticated server client: `src/lib/supabase/server.ts`
- privileged service-role client: `src/lib/supabase/admin.ts` (bypasses RLS)

`admin.ts` imports `server-only`, so importing it from a Client Component fails the build. ESLint also forbids importing it from `src/app`, `src/components`, `src/features` and `src/proxy.ts`. Do not work around either guard.

Use the service-role client only for jobs that genuinely act across users (feed ingestion in `scripts/`). Serve user requests with the server client so RLS applies.

## TypeScript

Use strict TypeScript (`strict` and `noUncheckedIndexedAccess` are on in `tsconfig.json`; do not relax them).

Avoid `any`.

Prefer `unknown` plus runtime validation when data crosses a trust boundary.

Validate external data such as RSS responses and user input.

Use generated Supabase database types where applicable.

Prefer explicit domain types over loosely shaped objects.

## RSS ingestion

RSS and Atom are untrusted external input.

Fetching must:

- use request timeouts
- handle malformed feeds
- handle redirects deliberately
- respect HTTP caching via ETag and Last-Modified where available
- avoid duplicate entries
- record useful failure information without leaking secrets
- avoid one broken feed aborting the entire refresh job

Normalize feed formats into the internal domain types in `src/lib/rss/types.ts` before persistence.

Ingestion runs as `npm run ingest` (`scripts/ingest-feeds.ts`), scheduled by a Render cron job with server-only credentials.

Ingestion operations must be idempotent.

Do not trust feed HTML.

Never render feed-provided HTML without sanitization.

## Data access

Prefer server-side data fetching for private application data.

Do not expose privileged database operations through client-side code.

Select only fields required by the current operation.

Avoid N+1 queries.

Add indexes when justified by actual query patterns.

## UI

Prefer Server Components unless browser interactivity requires a Client Component.

Keep Client Components as small as practical.

All interactive elements must be keyboard accessible.

Every UI change must work at mobile and desktop widths.

Loading, empty, error and success states must be considered explicitly.

Use yev-design for all visual and interaction decisions.

## Testing

For non-trivial behavior:

- add or update automated tests
- test domain logic independently from UI where practical
- include regression tests when fixing bugs

At minimum, before considering a task complete:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Also run `npm run test:db` for schema/RLS changes and `npm run test:e2e` for UI changes.

CI (`.github/workflows/ci.yml`) runs all of these plus a gitleaks secret scan of the full history. `npm run secrets:scan` runs the same scan locally.

Fix failures rather than suppressing them unless there is a documented reason.

## Code quality

Prefer small, focused modules.

Prefer clear code over clever abstractions.

Do not create abstractions for hypothetical future requirements.

Remove unused code.

Do not leave commented-out implementations.

Do not silently swallow errors.

Use descriptive names.

Comments should explain why, not restate what the code does.

## Dependencies

Before adding a dependency:

1. Check whether the problem can reasonably be solved with the existing stack.
2. Prefer small, maintained packages.
3. Avoid packages that duplicate existing functionality.
4. Do not add a package for trivial helpers.
5. Keep production dependencies minimal.

## Git

Keep changes scoped to the requested task.

Do not rewrite unrelated code.

Do not force-push.

Do not commit generated secrets or local environment files.

Use conventional commit messages where appropriate:

- `feat:`
- `fix:`
- `refactor:`
- `test:`
- `docs:`
- `chore:`

## Definition of done

A change is complete when:

- implementation is finished
- TypeScript passes
- lint passes
- relevant tests pass
- production build succeeds
- security implications have been considered
- no sensitive information is present
- database changes are represented as migrations/schema
- UI changes comply with yev-design
- relevant documentation is updated
