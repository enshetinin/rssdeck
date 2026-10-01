import { FeedFetchError, FeedParseError } from "@/lib/rss/errors";
import type { FetchFeedResult } from "@/lib/rss/fetch";
import type { CacheValidators, NormalizedFeed } from "@/lib/rss/types";

import { nextFetchAt } from "./schedule";
import type { DueFeed, FeedRepository } from "./types";

export type IngestionDependencies = {
  repository: FeedRepository;
  fetchFeed: (url: string, validators: CacheValidators) => Promise<FetchFeedResult>;
  parseFeed: (xml: string, feedUrl: string) => NormalizedFeed;
  now?: () => Date;
  /** Feeds fetched in parallel. */
  concurrency?: number;
  /** Maximum feeds handled per run; the rest stay due for the next run. */
  batchLimit?: number;
  /**
   * Also handle feeds that become due this soon. A feed fetched at 10:00:05
   * with a 60-minute interval is due at 11:00:05; without slack, an hourly
   * run at 11:00:00 would skip it until 12:00.
   */
  dueWithinMs?: number;
  logger?: Pick<Console, "info" | "error">;
};

export type FeedOutcome = "updated" | "not-modified" | "failed";

export type IngestionSummary = Record<FeedOutcome, number> & { processed: number };

/**
 * Fetches, parses and stores every due feed. A failing feed is recorded and
 * backed off; it never stops the others. Throws only if the due feeds cannot
 * be loaded at all.
 */
export async function runIngestion(deps: IngestionDependencies): Promise<IngestionSummary> {
  const {
    repository,
    now = () => new Date(),
    concurrency = 4,
    batchLimit = 200,
    dueWithinMs = 5 * 60_000,
  } = deps;

  const feeds = await repository.listDueFeeds(new Date(now().getTime() + dueWithinMs), batchLimit);
  const summary: IngestionSummary = { processed: 0, updated: 0, "not-modified": 0, failed: 0 };

  let next = 0;
  const worker = async () => {
    while (next < feeds.length) {
      const feed = feeds[next++];
      if (!feed) break;
      const outcome = await ingestFeed(feed, deps);
      summary.processed++;
      summary[outcome]++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, feeds.length) }, worker));

  return summary;
}

async function ingestFeed(feed: DueFeed, deps: IngestionDependencies): Promise<FeedOutcome> {
  const { repository, fetchFeed, parseFeed, now = () => new Date(), logger = console } = deps;

  try {
    const result = await fetchFeed(feed.feedUrl, feed.validators);
    const fetchedAt = now();
    const schedule = nextFetchAt(fetchedAt, feed.refreshIntervalMinutes, 0);

    if (result.status === "not-modified") {
      await repository.recordSuccess(feed, {
        now: fetchedAt,
        nextFetchAt: schedule,
        validators: result.validators,
        metadata: null,
      });
      return "not-modified";
    }

    const { entries, ...metadata } = parseFeed(result.body, result.finalUrl);
    await repository.saveEntries(feed.id, entries, fetchedAt);
    await repository.recordSuccess(feed, {
      now: fetchedAt,
      nextFetchAt: schedule,
      validators: result.validators,
      metadata: { ...metadata, entryCount: entries.length },
    });
    return "updated";
  } catch (error) {
    // Feed errors carry messages written to be stored; anything else may not.
    const message =
      error instanceof FeedFetchError || error instanceof FeedParseError
        ? error.message
        : "Internal error while ingesting this feed.";
    // Log the feed id, never its URL: private feed URLs often embed tokens.
    logger.error(`Feed ${feed.id} failed:`, error instanceof Error ? error.message : error);

    const failedAt = now();
    try {
      await repository.recordFailure(feed, {
        now: failedAt,
        nextFetchAt: nextFetchAt(
          failedAt,
          feed.refreshIntervalMinutes,
          feed.consecutiveFailureCount + 1,
        ),
        message,
      });
    } catch (recordError) {
      logger.error(
        `Feed ${feed.id}: recording the failure also failed:`,
        recordError instanceof Error ? recordError.message : recordError,
      );
    }
    return "failed";
  }
}
