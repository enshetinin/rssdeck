"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/features/auth/session";
import { createFeedRepository } from "@/features/ingestion/feed-repository";
import { describeRefresh } from "@/features/ingestion/refresh-summary";
import { RETENTION_POLICY } from "@/features/ingestion/retention";
import { runIngestion } from "@/features/ingestion/run-ingestion";
import { OpmlParseError, parseOpml } from "@/lib/opml/parse-opml";
import { FeedFetchError, FeedParseError } from "@/lib/rss/errors";
import { fetchFeed } from "@/lib/rss/fetch";
import { parseFeed } from "@/lib/rss/parse";
import { createClient } from "@/lib/supabase/server";

import { normalizeFeedUrl } from "./feed-url";
import { prepareImport } from "./prepare-import";
import { FeedNotFoundError, resolveFeed } from "./resolve-feed";

export type AddFeedState =
  | { status: "idle" }
  | { status: "error"; error: string; url: string }
  | { status: "added"; title: string; discovered: boolean };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Subscribes the signed-in user to a feed. The address may be the feed itself
 * or a web page that links to one. It is fetched once first, so a typo or a
 * page without a feed is reported now rather than as a failing subscription
 * later. Entries arrive with the next refresh.
 */
export async function addFeed(_previous: AddFeedState, formData: FormData): Promise<AddFeedState> {
  await requireUser();

  const input = String(formData.get("url") ?? "");
  const normalized = normalizeFeedUrl(input);
  if (!normalized.ok) return { status: "error", error: normalized.error, url: input };

  let resolved: Awaited<ReturnType<typeof resolveFeed>>;
  try {
    resolved = await resolveFeed(normalized.url);
  } catch (error) {
    if (error instanceof FeedNotFoundError) {
      return { status: "error", error: error.message, url: input };
    }
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
        error: `The address could not be loaded: ${error.message}`,
        url: input,
      };
    }
    throw error;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("feeds")
    .insert({ feed_url: resolved.feedUrl, title: resolved.title });

  if (error) {
    if (error.code === "23505") {
      return { status: "error", error: "You already follow this feed.", url: input };
    }
    throw new Error(`Adding feed failed: ${error.message}`);
  }

  revalidatePath("/", "layout");
  return {
    status: "added",
    title: resolved.title ?? new URL(resolved.feedUrl).hostname,
    discovered: resolved.discoveredFrom !== null,
  };
}

export type ImportFeedsState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | {
      status: "imported";
      added: number;
      alreadyFollowed: number;
      skipped: number;
      overLimit: number;
    };

const MAX_OPML_BYTES = 512 * 1024;

/**
 * Subscribes to every feed in an OPML file. Feeds are not fetched here (an
 * import can hold hundreds); the next refresh checks them and reports broken
 * ones under Manage feeds.
 */
export async function importFeeds(
  _previous: ImportFeedsState,
  formData: FormData,
): Promise<ImportFeedsState> {
  await requireUser();

  const file = formData.get("opml");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", error: "Choose an OPML file to import." };
  }
  if (file.size > MAX_OPML_BYTES) {
    return { status: "error", error: "This file is larger than 512 KB." };
  }

  let prepared: ReturnType<typeof prepareImport>;
  try {
    prepared = prepareImport(parseOpml(await file.text()));
  } catch (error) {
    if (error instanceof OpmlParseError) return { status: "error", error: error.message };
    throw error;
  }
  if (prepared.feeds.length === 0) {
    return { status: "error", error: "This file does not contain any feed addresses." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feeds")
    .upsert(
      prepared.feeds.map((feed) => ({ feed_url: feed.url, title: feed.title })),
      // Feeds the user already follows are left as they are.
      { onConflict: "user_id,feed_url", ignoreDuplicates: true },
    )
    .select("id");

  if (error) throw new Error(`Importing feeds failed: ${error.message}`);

  revalidatePath("/", "layout");
  return {
    status: "imported",
    added: data.length,
    alreadyFollowed: prepared.feeds.length - data.length,
    skipped: prepared.invalid + prepared.duplicates,
    overLimit: prepared.overLimit,
  };
}

export type UpdateFeedState =
  | { status: "idle" }
  | { status: "error"; error: string; title: string }
  | { status: "saved"; savedAt: number };

const MAX_TITLE_LENGTH = 1000;

/**
 * Renames a feed. An empty title goes back to the feed's own title, filled in
 * by the next full refresh.
 */
export async function updateFeed(
  _previous: UpdateFeedState,
  formData: FormData,
): Promise<UpdateFeedState> {
  await requireUser();

  const feedId = String(formData.get("feedId") ?? "");
  const title = String(formData.get("title") ?? "").trim();

  if (!UUID_PATTERN.test(feedId)) {
    return { status: "error", error: "This feed no longer exists.", title };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { status: "error", error: "Use a title of at most 1000 characters.", title };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feeds")
    .update({ title: title || null })
    .eq("id", feedId)
    .select("id");

  if (error) throw new Error(`Updating feed failed: ${error.message}`);
  // RLS hides other users' feeds, so "not yours" and "already gone" look the same.
  if (data.length === 0) return { status: "error", error: "This feed no longer exists.", title };

  revalidatePath("/", "layout");
  return { status: "saved", savedAt: Date.now() };
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

  revalidatePath("/", "layout");
  return { status: "removed" };
}

export type RefreshFeedsState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "refreshed"; message: string; failed: number };

/**
 * Fetches all of the signed-in user's feeds now, then prunes old entries.
 * Runs as the user: writes go through database functions limited to their
 * own feeds. One broken feed is recorded on that feed and never stops the rest.
 */
export async function refreshFeeds(): Promise<RefreshFeedsState> {
  await requireUser();

  const repository = createFeedRepository(await createClient());
  try {
    const summary = await runIngestion({
      repository,
      fetchFeed: (url, validators) => fetchFeed(url, validators),
      parseFeed,
      concurrency: 6,
    });
    // After fetching, so it sees what every feed contains right now.
    await repository.pruneEntries(RETENTION_POLICY);

    revalidatePath("/", "layout");
    return { status: "refreshed", message: describeRefresh(summary), failed: summary.failed };
  } catch (error) {
    // Only the run itself failing (e.g. the database is unreachable) gets here.
    console.error("Refreshing feeds failed:", error instanceof Error ? error.message : error);
    revalidatePath("/", "layout");
    return { status: "error", error: "Refreshing failed. Try again in a moment." };
  }
}
