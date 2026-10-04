import type { SupabaseClient } from "@supabase/supabase-js";

import type { NormalizedEntry } from "@/lib/rss/types";
import type { Database, TablesInsert, TablesUpdate } from "@/types/database";

import type { FeedRepository, IngestionFeed } from "./types";

const UPSERT_BATCH_SIZE = 100;

/**
 * Supabase-backed persistence for ingestion, acting as the signed-in user.
 * Users cannot write entries or bookkeeping columns directly; the writes go
 * through SECURITY DEFINER functions limited to the caller's own feeds.
 */
export function createFeedRepository(supabase: SupabaseClient<Database>): FeedRepository {
  return {
    async listFeeds(limit) {
      // RLS limits the rows to the caller's feeds.
      const { data, error } = await supabase
        .from("feeds")
        .select("id, feed_url, title, etag, last_modified, consecutive_failure_count")
        .order("last_fetched_at", { ascending: true, nullsFirst: true })
        .limit(limit);

      if (error) throw new Error(`Loading feeds failed: ${error.message}`);

      return data.map((row): IngestionFeed => ({
        id: row.id,
        feedUrl: row.feed_url,
        title: row.title,
        validators: { etag: row.etag, lastModified: row.last_modified },
        consecutiveFailureCount: row.consecutive_failure_count,
      }));
    },

    async saveEntries(feedId, entries, seenAt) {
      for (let start = 0; start < entries.length; start += UPSERT_BATCH_SIZE) {
        const rows = entries
          .slice(start, start + UPSERT_BATCH_SIZE)
          .map((entry) => toEntryRow(feedId, entry, seenAt));
        // Idempotent: re-ingesting the same entries updates them in place.
        const { error } = await supabase.rpc("save_own_feed_entries", {
          p_feed_id: feedId,
          p_entries: rows,
        });
        if (error) throw new Error(`Saving entries failed: ${error.message}`);
      }
    },

    async recordSuccess(feed, { now, validators, metadata }) {
      const update: TablesUpdate<"feeds"> = {
        etag: validators.etag,
        last_modified: validators.lastModified,
        last_fetched_at: now.toISOString(),
        last_succeeded_at: now.toISOString(),
        last_error: null,
        consecutive_failure_count: 0,
      };
      if (metadata) {
        // A full fetch: entries not upserted just now have left the feed.
        // An empty feed is more likely a glitch than the truth; do not let it
        // mark every entry as gone.
        if (metadata.entryCount > 0) update.last_parsed_at = now.toISOString();
        update.site_url = metadata.siteUrl;
        update.description = metadata.description;
        update.favicon_url = metadata.faviconUrl;
        // The title is user-editable; only fill it in, never overwrite it.
        if (feed.title === null) update.title = metadata.title;
      }
      await updateFeed(feed.id, update);
    },

    async pruneEntries({ readDays, unreadDays }) {
      const { data, error } = await supabase.rpc("prune_own_entries", {
        p_read_days: readDays,
        p_unread_days: unreadDays,
      });
      if (error) throw new Error(`Pruning entries failed: ${error.message}`);
      return data;
    },

    async recordFailure(feed, { now, message }) {
      await updateFeed(feed.id, {
        last_fetched_at: now.toISOString(),
        last_error: message,
        consecutive_failure_count: feed.consecutiveFailureCount + 1,
      });
    },
  };

  async function updateFeed(feedId: string, update: TablesUpdate<"feeds">) {
    const { error } = await supabase.rpc("update_own_feed_state", {
      p_feed_id: feedId,
      p_state: update,
    });
    if (error) throw new Error(`Updating feed failed: ${error.message}`);
  }
}

function toEntryRow(feedId: string, entry: NormalizedEntry, seenAt: Date): TablesInsert<"entries"> {
  return {
    feed_id: feedId,
    last_seen_at: seenAt.toISOString(),
    external_id: entry.externalId,
    title: entry.title,
    url: entry.url,
    author: entry.author,
    summary: entry.summary,
    content: entry.content,
    published_at: entry.publishedAt?.toISOString() ?? null,
  };
}
