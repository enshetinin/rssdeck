import "server-only";

import { cache } from "react";

import { htmlToPlainText, truncate } from "@/lib/rss/text";
import { createClient } from "@/lib/supabase/server";

import type { Cursor, EntryFilter } from "./view-params";

export const PAGE_SIZE = 50;
const EXCERPT_LENGTH = 180;

export type EntrySummary = {
  id: string;
  feedId: string;
  feedName: string;
  title: string;
  excerpt: string | null;
  sortAt: string;
  isRead: boolean;
  isStarred: boolean;
};

export type EntryPage = {
  entries: EntrySummary[];
  /** Cursor for the next (older) page, if there is one. */
  older: Cursor | null;
};

/**
 * One page of the caller's timeline, newest first. With the unread filter,
 * `keepEntryId` stays in the list after it is read, so opening an entry does
 * not make it vanish from under the reader.
 */
export async function listEntries(options: {
  filter: EntryFilter;
  feedId: string | null;
  before: Cursor | null;
  keepEntryId: string | null;
}): Promise<EntryPage> {
  const supabase = await createClient();
  let query = supabase
    .from("entry_list")
    .select(
      "id, feed_id, feed_title, feed_url, title, excerpt_source, sort_at, is_read, is_starred",
    )
    .order("sort_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (options.feedId) query = query.eq("feed_id", options.feedId);
  if (options.filter === "starred") query = query.eq("is_starred", true);
  if (options.filter === "unread") {
    query = options.keepEntryId
      ? query.or(`is_read.eq.false,id.eq.${options.keepEntryId}`)
      : query.eq("is_read", false);
  }
  if (options.before) {
    // Values are validated by parseCursor (ISO timestamp, UUID) before use.
    const { sortAt, id } = options.before;
    query = query.or(`sort_at.lt."${sortAt}",and(sort_at.eq."${sortAt}",id.lt.${id})`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Loading entries failed: ${error.message}`);

  const rows = data.slice(0, PAGE_SIZE);
  const last = rows.at(-1);
  return {
    entries: rows.map((row) => ({
      id: row.id ?? "",
      feedId: row.feed_id ?? "",
      feedName: feedName(row.feed_title, row.feed_url),
      title: row.title ?? "Untitled",
      excerpt: excerpt(row.excerpt_source),
      sortAt: row.sort_at ?? "",
      isRead: row.is_read ?? false,
      isStarred: row.is_starred ?? false,
    })),
    older:
      data.length > PAGE_SIZE && last?.sort_at && last.id
        ? { sortAt: last.sort_at, id: last.id }
        : null,
  };
}

export type EntryDetail = {
  id: string;
  feedId: string;
  feedName: string;
  title: string;
  url: string | null;
  author: string | null;
  /** Untrusted feed HTML. Sanitize before rendering. */
  html: string | null;
  publishedAt: string | null;
  isRead: boolean;
  isStarred: boolean;
};

export async function getEntry(id: string): Promise<EntryDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entry_list")
    .select(
      "id, feed_id, feed_title, feed_url, title, url, author, summary, content, published_at, is_read, is_starred",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Loading entry failed: ${error.message}`);
  if (!data?.id || !data.feed_id) return null;

  return {
    id: data.id,
    feedId: data.feed_id,
    feedName: feedName(data.feed_title, data.feed_url),
    title: data.title ?? "Untitled",
    url: data.url,
    author: data.author,
    html: data.content ?? data.summary,
    publishedAt: data.published_at,
    isRead: data.is_read ?? false,
    isStarred: data.is_starred ?? false,
  };
}

export type SidebarFeed = {
  id: string;
  name: string;
  unread: number;
  isFailing: boolean;
};

export type SidebarData = {
  total: number;
  unread: number;
  starred: number;
  feeds: SidebarFeed[];
};

/**
 * Feeds and counts for the navigation, in two queries regardless of feed
 * count. Cached per request: the layout and the page both need it.
 */
export const getSidebarData = cache(async (): Promise<SidebarData> => {
  const supabase = await createClient();
  const [feedsResult, countsResult] = await Promise.all([
    supabase
      .from("feeds")
      .select("id, title, feed_url, consecutive_failure_count")
      .order("title", { ascending: true, nullsFirst: false }),
    supabase.rpc("entry_counts"),
  ]);

  if (feedsResult.error) throw new Error(`Loading feeds failed: ${feedsResult.error.message}`);
  if (countsResult.error) throw new Error(`Loading counts failed: ${countsResult.error.message}`);

  const counts = new Map(countsResult.data.map((row) => [row.feed_id, row]));
  let total = 0;
  let unread = 0;
  let starred = 0;
  for (const row of countsResult.data) {
    total += row.total;
    unread += row.unread;
    starred += row.starred;
  }

  return {
    total,
    unread,
    starred,
    feeds: feedsResult.data.map((feed) => ({
      id: feed.id,
      name: feedName(feed.title, feed.feed_url),
      unread: counts.get(feed.id)?.unread ?? 0,
      isFailing: feed.consecutive_failure_count > 0,
    })),
  };
});

export function feedName(title: string | null, feedUrl: string | null): string {
  if (title) return title;
  try {
    return feedUrl ? new URL(feedUrl).hostname : "Untitled feed";
  } catch {
    return "Untitled feed";
  }
}

function excerpt(source: string | null): string | null {
  if (!source) return null;
  const text = htmlToPlainText(source);
  if (!text) return null;
  return text.length > EXCERPT_LENGTH ? `${truncate(text, EXCERPT_LENGTH).trimEnd()}…` : text;
}
