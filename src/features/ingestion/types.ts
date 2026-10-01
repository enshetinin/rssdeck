import type { CacheValidators, NormalizedEntry, NormalizedFeed } from "@/lib/rss/types";

export type DueFeed = {
  id: string;
  feedUrl: string;
  title: string | null;
  validators: CacheValidators;
  refreshIntervalMinutes: number;
  consecutiveFailureCount: number;
};

export type FeedMetadata = Omit<NormalizedFeed, "entries">;

/** Persistence operations ingestion needs. Implemented over Supabase in feed-repository.ts. */
export type FeedRepository = {
  listDueFeeds(now: Date, limit: number): Promise<DueFeed[]>;
  saveEntries(feedId: string, entries: NormalizedEntry[]): Promise<void>;
  recordSuccess(
    feed: DueFeed,
    result: {
      now: Date;
      nextFetchAt: Date;
      validators: CacheValidators;
      /** Null when the feed was not modified. */
      metadata: FeedMetadata | null;
    },
  ): Promise<void>;
  recordFailure(
    feed: DueFeed,
    result: { now: Date; nextFetchAt: Date; message: string },
  ): Promise<void>;
};
