import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

import type { Database } from "../../src/types/database";

// The fictional user created by supabase/seed.sql. Local stack only.
export const DEV_USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "dev@example.com",
  password: "rssdeck-local-dev",
};

export async function signIn(page: Page, next = "/") {
  await page.goto(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(DEV_USER.email);
  await page.getByLabel("Password").fill(DEV_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === next);
}

/** Service-role client for arranging test data in the local database. */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("E2E tests need the local Supabase values in .env.local.");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

/** A feed owned by the dev user, unique per test so parallel tests do not collide. */
export async function createTestFeed(
  overrides: Partial<Database["public"]["Tables"]["feeds"]["Insert"]> = {},
) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const { data, error } = await adminClient()
    .from("feeds")
    .insert({
      user_id: DEV_USER.id,
      feed_url: `https://e2e-${suffix}.example.test/feed.xml`,
      title: `E2E feed ${suffix}`,
      ...overrides,
    })
    .select("id, title, feed_url")
    .single();
  if (error) throw new Error(`Creating test feed failed: ${error.message}`);
  return data;
}

export async function deleteTestFeed(id: string) {
  await adminClient().from("feeds").delete().eq("id", id);
}

/** Entries for a test feed, newest first: "Entry 1" is the most recent. */
export async function createTestEntries(feedId: string, count: number) {
  const now = Date.now();
  const rows = Array.from({ length: count }, (_, index) => ({
    feed_id: feedId,
    external_id: `e2e-${index + 1}`,
    title: `Entry ${index + 1}`,
    url: `https://e2e.example.test/${index + 1}`,
    summary: `<p>Summary of entry ${index + 1}.</p><script>window.__pwned = true</script>`,
    published_at: new Date(now - (index + 1) * 60_000).toISOString(),
  }));
  const { error } = await adminClient().from("entries").insert(rows);
  if (error) throw new Error(`Creating test entries failed: ${error.message}`);
}
