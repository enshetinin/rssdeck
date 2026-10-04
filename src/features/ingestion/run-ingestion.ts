import { FeedFetchError, FeedParseError } from "@/lib/rss/errors";
import type { FetchFeedResult } from "@/lib/rss/fetch";
import type { CacheValidators, NormalizedFeed } from "@/lib/rss/types";

import type { FeedRepository, IngestionFeed } from "./types";

export type IngestionDependencies = {
  repository: FeedRepository;
  fetchFeed: (url: string, validators: CacheValidators) => Promise<FetchFeedResult>;
  parseFeed: (xml: string, feedUrl: string) => NormalizedFeed;
  now?: () => Date;
  /** Feeds fetched in parallel. */
  concurrency?: number;
  /** Maximum feeds handled per run; the least recently fetched go first. */
  batchLimit?: number;
  logger?: Pick<Console, "info" | "error">;
};

export type FeedOutcome = "updated" | "not-modified" | "failed";

export type IngestionSummary = Record<FeedOutcome, number> & { processed: number };

/**
 * Fetches, parses and stores the repository's feeds. A failing feed is
 * recorded; it never stops the others. Throws only if the feeds cannot be
 * loaded at all.
 */
export async function runIngestion(deps: IngestionDependencies): Promise<IngestionSummary> {
  const { repository, concurrency = 4, batchLimit = 500 } = deps;

  const feeds = await repository.listFeeds(batchLimit);
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

async function ingestFeed(feed: IngestionFeed, deps: IngestionDependencies): Promise<FeedOutcome> {
  const { repository, fetchFeed, parseFeed, now = () => new Date(), logger = console } = deps;

  try {
    const result = await fetchFeed(feed.feedUrl, feed.validators);
    const fetchedAt = now();

    if (result.status === "not-modified") {
      await repository.recordSuccess(feed, {
        now: fetchedAt,
        validators: result.validators,
        metadata: null,
      });
      return "not-modified";
    }

    const { entries, ...metadata } = parseFeed(result.body, result.finalUrl);
    await repository.saveEntries(feed.id, entries, fetchedAt);
    await repository.recordSuccess(feed, {
      now: fetchedAt,
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

    try {
      await repository.recordFailure(feed, { now: now(), message });
    } catch (recordError) {
      logger.error(
        `Feed ${feed.id}: recording the failure also failed:`,
        recordError instanceof Error ? recordError.message : recordError,
      );
    }
    return "failed";
  }
}
