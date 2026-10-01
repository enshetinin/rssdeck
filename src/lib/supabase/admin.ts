import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { getSupabaseUrl } from "./env";

/**
 * Privileged Supabase client. BYPASSES ROW LEVEL SECURITY.
 *
 * Only for trusted server-side jobs that act on behalf of no particular user,
 * such as feed ingestion. Never use it to serve a user request: use
 * `@/lib/supabase/server` so RLS applies. `server-only` makes any import from
 * a Client Component fail the build.
 */
export function createAdminClient() {
  // Needs only the URL and the service-role key: the ingestion job is not
  // given the publishable key (render.yaml).
  const url = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (server-only). Locally, set it in .env.local; in production, on the Render cron job.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
