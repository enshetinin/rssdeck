import type { CacheValidators, NormalizedEntry, NormalizedFeed } from "@/lib/rss/types";

export type DueFeed = {
  id: string;
  feedUrl: string;
  title: string | null;
  validators: CacheValidators;
  refreshIntervalMinutes: number;
  consecutiveFailureCount: number;
};

export type FeedMetadata = Omit<NormalizedFeed, "entries"> & {
  /** How many entries the full fetch contained. */
  entryCount: number;
};

/** Persistence operations ingestion needs. Implemented over Supabase in feed-repository.ts. */
export type FeedRepository = {
  listDueFeeds(now: Date, limit: number): Promise<DueFeed[]>;
  /** Upserts entries and records them as present in the feed at `seenAt`. */
  saveEntries(feedId: string, entries: NormalizedEntry[], seenAt: Date): Promise<void>;
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
  /** Deletes old entries that have left their feeds; returns how many. */
  pruneEntries(policy: RetentionPolicy): Promise<number>;
  recordFailure(
    feed: DueFeed,
    result: { now: Date; nextFetchAt: Date; message: string },
  ): Promise<void>;
};

export type RetentionPolicy = {
  /** Read entries are kept this many days after they were first seen. */
  readDays: number;
  /** Unread entries are kept this many days after they were first seen. */
  unreadDays: number;
};
