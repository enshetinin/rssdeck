import "server-only";

import { createClient } from "@/lib/supabase/server";

export type FeedListItem = {
  id: string;
  feedUrl: string;
  title: string | null;
  siteUrl: string | null;
  lastSucceededAt: string | null;
  lastError: string | null;
  consecutiveFailureCount: number;
};

/** The signed-in user's feeds. RLS limits the rows to their own. */
export async function listFeeds(): Promise<FeedListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feeds")
    .select(
      "id, feed_url, title, site_url, last_succeeded_at, last_error, consecutive_failure_count",
    )
    .order("title", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Loading feeds failed: ${error.message}`);

  return data.map((row) => ({
    id: row.id,
    feedUrl: row.feed_url,
    title: row.title,
    siteUrl: row.site_url,
    lastSucceededAt: row.last_succeeded_at,
    lastError: row.last_error,
    consecutiveFailureCount: row.consecutive_failure_count,
  }));
}
