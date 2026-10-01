"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/features/auth/session";
import { FeedFetchError, FeedParseError } from "@/lib/rss/errors";
import { fetchFeed } from "@/lib/rss/fetch";
import { parseFeed } from "@/lib/rss/parse";
import { createClient } from "@/lib/supabase/server";

import { normalizeFeedUrl } from "./feed-url";

export type AddFeedState =
  | { status: "idle" }
  | { status: "error"; error: string; url: string }
  | { status: "added"; title: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Subscribes the signed-in user to a feed. The feed is fetched once first, so
 * a typo or a web page that is not a feed is reported now rather than as a
 * failing subscription later. Entries arrive with the next ingestion run.
 */
export async function addFeed(_previous: AddFeedState, formData: FormData): Promise<AddFeedState> {
  await requireUser();

  const input = String(formData.get("url") ?? "");
  const normalized = normalizeFeedUrl(input);
  if (!normalized.ok) return { status: "error", error: normalized.error, url: input };

  let feedUrl: string;
  let title: string | null;
  try {
    const result = await fetchFeed(normalized.url, { etag: null, lastModified: null });
    if (result.status !== "ok") throw new FeedFetchError("Unexpected 304 response.");
    feedUrl = result.finalUrl;
    title = parseFeed(result.body, result.finalUrl).title;
  } catch (error) {
    if (error instanceof FeedParseError) {
      return {
        status: "error",
        error: "This address does not point to an RSS or Atom feed.",
        url: input,
      };
    }
    if (error instanceof FeedFetchError) {
      return {
        status: "error",
        error: `The feed could not be loaded: ${error.message}`,
        url: input,
      };
    }
    throw error;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("feeds").insert({ feed_url: feedUrl, title });

  if (error) {
    if (error.code === "23505") {
      return { status: "error", error: "You already follow this feed.", url: input };
    }
    throw new Error(`Adding feed failed: ${error.message}`);
  }

  revalidatePath("/feeds");
  revalidatePath("/");
  return { status: "added", title: title ?? new URL(feedUrl).hostname };
}

export type RemoveFeedState =
  { status: "idle" } | { status: "error"; error: string } | { status: "removed" };

/** Unsubscribes; entries and read/starred state go with the feed (ON DELETE CASCADE). */
export async function removeFeed(
  _previous: RemoveFeedState,
  formData: FormData,
): Promise<RemoveFeedState> {
  await requireUser();

  const feedId = String(formData.get("feedId") ?? "");
  if (!UUID_PATTERN.test(feedId)) return { status: "error", error: "This feed no longer exists." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("feeds").delete().eq("id", feedId).select("id");

  if (error) throw new Error(`Removing feed failed: ${error.message}`);
  // RLS hides other users' feeds, so "not yours" and "already gone" look the same.
  if (data.length === 0) return { status: "error", error: "This feed no longer exists." };

  revalidatePath("/feeds");
  revalidatePath("/");
  return { status: "removed" };
}
