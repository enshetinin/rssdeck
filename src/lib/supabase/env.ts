// Public Supabase settings. Both values are safe to ship to the browser;
// data access is enforced by RLS, not by keeping these secret.

const SETUP_HINT = "Locally, set it in .env.local (see .env.example); in production, in Render.";

export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

export function getSupabaseUrl(): string {
  // Referenced literally so Next.js can inline it into client bundles.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error(`Missing NEXT_PUBLIC_SUPABASE_URL. ${SETUP_HINT}`);
  return url;
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = getSupabaseUrl();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error(`Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ${SETUP_HINT}`);
  }
  return { url, publishableKey };
}
