// Feed ingestion entry point, run on a schedule by a Render cron job:
//   npm run ingest
//
// Runs with the server-only service-role client because it works across all
// users' feeds. Fetching and parsing are not implemented yet; for now this
// verifies configuration and reports which feeds are due.

import { createAdminClient } from "@/lib/supabase/admin";

async function main(): Promise<void> {
  const supabase = createAdminClient();

  const { data: dueFeeds, error } = await supabase
    .from("feeds")
    .select("id")
    .lte("next_fetch_at", new Date().toISOString());

  if (error) {
    throw new Error(`Could not load due feeds: ${error.message}`);
  }

  console.info(`${dueFeeds.length} feed(s) due. Fetching is not implemented yet.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
