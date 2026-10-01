// Feed ingestion entry point, run on a schedule by a Render cron job:
//   npm run ingest
//
// Uses the server-only service-role client because it works across all users'
// feeds and writes entries, which users cannot. After fetching, it prunes old
// entries that have left their feeds (see features/ingestion/retention.ts).

import { createFeedRepository } from "@/features/ingestion/feed-repository";
import { RETENTION_POLICY } from "@/features/ingestion/retention";
import { runIngestion } from "@/features/ingestion/run-ingestion";
import { fetchFeed } from "@/lib/rss/fetch";
import { parseFeed } from "@/lib/rss/parse";
import { createAdminClient } from "@/lib/supabase/admin";

async function main(): Promise<void> {
  const startedAt = Date.now();
  const repository = createFeedRepository(createAdminClient());

  const summary = await runIngestion({
    repository,
    fetchFeed: (url, validators) => fetchFeed(url, validators),
    parseFeed,
  });
  console.info(
    `Ingestion finished in ${Date.now() - startedAt} ms: ${summary.processed} processed, ` +
      `${summary.updated} updated, ${summary["not-modified"]} not modified, ${summary.failed} failed.`,
  );

  // Runs after ingestion so it sees what every feed contains right now.
  const pruned = await repository.pruneEntries(RETENTION_POLICY);
  console.info(`Pruned ${pruned} old ${pruned === 1 ? "entry" : "entries"}.`);
}

// Individual feed failures are expected and recorded per feed; only a failure
// of the run itself (e.g. the database is unreachable) fails the job.
main().catch((error: unknown) => {
  console.error("Ingestion run failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
