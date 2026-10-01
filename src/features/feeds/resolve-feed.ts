import { discoverFeedLinks } from "@/lib/rss/discover";
import { FeedFetchError, FeedParseError } from "@/lib/rss/errors";
import { fetchFeed as defaultFetchFeed, type FetchFeedResult } from "@/lib/rss/fetch";
import { parseFeed as defaultParseFeed } from "@/lib/rss/parse";
import type { CacheValidators, NormalizedFeed } from "@/lib/rss/types";

/** The page loaded but is neither a feed nor links to one. */
export class FeedNotFoundError extends Error {
  override name = "FeedNotFoundError";
}

export type ResolvedFeed = {
  feedUrl: string;
  title: string | null;
  /** The web page the feed was found on, when the address was not a feed itself. */
  discoveredFrom: string | null;
};

type Dependencies = {
  fetchFeed: (url: string, validators: CacheValidators) => Promise<FetchFeedResult>;
  parseFeed: (xml: string, feedUrl: string) => NormalizedFeed;
};

const MAX_CANDIDATES = 3;
const NO_VALIDATORS: CacheValidators = { etag: null, lastModified: null };

/**
 * Turns what a user typed into a feed URL: the address itself if it is a
 * feed, otherwise the first feed the page advertises that actually parses.
 *
 * @throws FeedFetchError, FeedParseError or FeedNotFoundError (all with
 * messages safe to show).
 */
export async function resolveFeed(
  url: string,
  deps: Dependencies = { fetchFeed: defaultFetchFeed, parseFeed: defaultParseFeed },
): Promise<ResolvedFeed> {
  const page = await fetchBody(url, deps);
  try {
    const feed = deps.parseFeed(page.body, page.finalUrl);
    return { feedUrl: page.finalUrl, title: feed.title, discoveredFrom: null };
  } catch (error) {
    if (!(error instanceof FeedParseError)) throw error;
  }

  const candidates = discoverFeedLinks(page.body, page.finalUrl).slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) {
    throw new FeedNotFoundError("This page is not a feed and does not link to one.");
  }

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      const result = await fetchBody(candidate, deps);
      const feed = deps.parseFeed(result.body, result.finalUrl);
      return { feedUrl: result.finalUrl, title: feed.title, discoveredFrom: page.finalUrl };
    } catch (error) {
      if (!(error instanceof FeedFetchError || error instanceof FeedParseError)) throw error;
      lastError = error;
    }
  }
  throw new FeedNotFoundError(
    `The page links to a feed, but it could not be loaded${lastError ? `: ${lastError.message}` : "."}`,
  );
}

async function fetchBody(url: string, deps: Dependencies) {
  const result = await deps.fetchFeed(url, NO_VALIDATORS);
  // Without validators a server has nothing to answer 304 to; treat it as broken.
  if (result.status !== "ok") throw new FeedFetchError("Unexpected 304 response.");
  return result;
}
