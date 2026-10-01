# Deployment

RSSDeck runs on two hosted pieces:

- **Supabase**: PostgreSQL, Auth and the Data API.
- **Render**: the Next.js web service and a cron job that ingests feeds.

```
Browser ──▶ Render web (Next.js) ──▶ Supabase (Auth, Data API, RLS)
Render cron (npm run ingest) ──────▶ Supabase (service role) ──▶ feeds on the web
```

The web service only ever holds the public URL and publishable key; every
request runs as the signed-in user under RLS. Only the cron job holds the
service-role key.

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com/dashboard). Pick a
   region near the Render region in `render.yaml` (Frankfurt ↔ `eu-central-1`).
   Store the database password in your password manager.
2. Apply the schema from the migrations (from a clone of this repository):

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>   # asks for the database password
   npx supabase db push                            # applies supabase/migrations/
   ```

   `db push` does not run `supabase/seed.sql`; the fictional development user
   never reaches production.

3. **Authentication → Sign In / Providers**: keep Email enabled and turn off
   **Allow new users to sign up**. RSSDeck has no sign-up page, and this stops
   anyone creating an account through the API.
4. **Authentication → Users → Add user → Create new user**: enter your email
   and a strong password, and tick **Auto Confirm User**.
5. **Authentication → URL Configuration**: set **Site URL** to the Render URL
   (for example `https://rssdeck.onrender.com`, known after Render step 4 below;
   come back to it).
6. **Project Settings → API Keys**: note the **Project URL**, the **publishable
   key** (`sb_publishable_…`) and a **secret key** (`sb_secret_…`). The secret
   key bypasses RLS: never put it in the repository, a `NEXT_PUBLIC_` variable,
   or the web service.

## 2. Render

1. Push `main` to GitHub with `render.yaml` at the root.
2. In the [Render Dashboard](https://dashboard.render.com): **New → Blueprint**,
   connect the GitHub repository, and select `render.yaml`.
3. Render asks for the `sync: false` values:

   | Service          | Variable                               | Value                |
   | ---------------- | -------------------------------------- | -------------------- |
   | `rssdeck`        | `NEXT_PUBLIC_SUPABASE_URL`             | Supabase Project URL |
   | `rssdeck`        | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key      |
   | `rssdeck-ingest` | `NEXT_PUBLIC_SUPABASE_URL`             | Supabase Project URL |
   | `rssdeck-ingest` | `SUPABASE_SERVICE_ROLE_KEY`            | Secret key           |

   Render only prompts for these on the first Blueprint sync. To change them
   later, edit the service's **Environment** page.

4. Wait for both services to build. Note the web service URL and finish
   Supabase step 1.5.
5. Open the URL, sign in with the user from Supabase step 1.4, and add feeds
   under **Manage feeds**. Entries appear after the next cron run (at most an
   hour), or trigger one with **Trigger Run** on the `rssdeck-ingest` job.

## Costs and limits

- **Web service, free plan**: sleeps after a period without traffic; the first
  request afterwards takes a while to wake it. A paid plan avoids that.
- **Cron job**: Render has no free plan for cron jobs. It is billed per second
  of running time with a minimum of $1 per month; at seconds per hourly run,
  the minimum is what you pay. **Billing** in the Render Dashboard shows the
  month so far, and the job's page lists each run with its duration.
- **Supabase free plan**: projects with no activity for a while are paused.
  Ingestion talks to the database every hour, which normally keeps it
  active; check the Supabase dashboard if the app stops loading.

## Releasing changes

- Pushing to `main` runs CI; Render deploys both services only after the
  checks pass (`autoDeployTrigger: checksPass`).
- **Schema changes are not applied automatically.** When a commit adds a
  migration, run `npx supabase db push` before (or right as) that commit
  deploys, so the new code never meets the old schema. Migrations are
  additive by convention, so applying them first is safe.
- Never change the production schema in the Supabase dashboard: every change
  goes through `supabase/migrations/`.

## Troubleshooting

| Symptom                                           | Check                                                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Build fails with a missing Supabase variable      | Both `NEXT_PUBLIC_` variables are set on the web service (they are read at build time).                     |
| Sign-in always says the password is wrong         | The user exists and is confirmed in Supabase **Authentication → Users**.                                    |
| Feeds never get entries                           | `rssdeck-ingest` logs; its URL and secret key; the feed's error under **Manage feeds**.                     |
| Ingestion logs `permission denied` or a JWT error | `SUPABASE_SERVICE_ROLE_KEY` holds the secret key (`sb_secret_…`), not the publishable key or a placeholder. |
