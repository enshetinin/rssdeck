import type { SupabaseClient } from "@supabase/supabase-js";

import type { NormalizedEntry } from "@/lib/rss/types";
import type { Database, TablesInsert, TablesUpdate } from "@/types/database";

import type { DueFeed, FeedRepository } from "./types";

const UPSERT_BATCH_SIZE = 100;

/**
 * Supabase-backed persistence for ingestion. Needs a client that may write
 * entries and bookkeeping columns, i.e. the service-role client.
 */
export function createFeedRepository(supabase: SupabaseClient<Database>): FeedRepository {
  return {
    async listDueFeeds(now, limit) {
      const { data, error } = await supabase
        .from("feeds")
        .select(
          "id, feed_url, title, etag, last_modified, refresh_interval_minutes, consecutive_failure_count",
        )
        .lte("next_fetch_at", now.toISOString())
        .order("next_fetch_at")
        .limit(limit);

      if (error) throw new Error(`Loading due feeds failed: ${error.message}`);

      return data.map((row): DueFeed => ({
        id: row.id,
        feedUrl: row.feed_url,
        title: row.title,
        validators: { etag: row.etag, lastModified: row.last_modified },
        refreshIntervalMinutes: row.refresh_interval_minutes,
        consecutiveFailureCount: row.consecutive_failure_count,
      }));
    },

    async saveEntries(feedId, entries) {
      for (let start = 0; start < entries.length; start += UPSERT_BATCH_SIZE) {
        const rows = entries
          .slice(start, start + UPSERT_BATCH_SIZE)
          .map((entry) => toEntryRow(feedId, entry));
        // Idempotent: re-ingesting the same entries updates them in place.
        const { error } = await supabase
          .from("entries")
          .upsert(rows, { onConflict: "feed_id,external_id" });
        if (error) throw new Error(`Saving entries failed: ${error.message}`);
      }
    },

    async recordSuccess(feed, { now, nextFetchAt, validators, metadata }) {
      const update: TablesUpdate<"feeds"> = {
        etag: validators.etag,
        last_modified: validators.lastModified,
        last_fetched_at: now.toISOString(),
        last_succeeded_at: now.toISOString(),
        last_error: null,
        consecutive_failure_count: 0,
        next_fetch_at: nextFetchAt.toISOString(),
      };
      if (metadata) {
        update.site_url = metadata.siteUrl;
        update.description = metadata.description;
        update.favicon_url = metadata.faviconUrl;
        // The title is user-editable; only fill it in, never overwrite it.
        if (feed.title === null) update.title = metadata.title;
      }
      await updateFeed(feed.id, update);
    },

    async recordFailure(feed, { now, nextFetchAt, message }) {
      await updateFeed(feed.id, {
        last_fetched_at: now.toISOString(),
        last_error: message,
        consecutive_failure_count: feed.consecutiveFailureCount + 1,
        next_fetch_at: nextFetchAt.toISOString(),
      });
    },
  };

  async function updateFeed(feedId: string, update: TablesUpdate<"feeds">) {
    const { error } = await supabase.from("feeds").update(update).eq("id", feedId);
    if (error) throw new Error(`Updating feed failed: ${error.message}`);
  }
}

function toEntryRow(feedId: string, entry: NormalizedEntry): TablesInsert<"entries"> {
  return {
    feed_id: feedId,
    external_id: entry.externalId,
    title: entry.title,
    url: entry.url,
    author: entry.author,
    summary: entry.summary,
    content: entry.content,
    published_at: entry.publishedAt?.toISOString() ?? null,
  };
}
