import { describe, expect, it, vi } from "vitest";

import { FeedNotFoundError, resolveFeed } from "@/features/feeds/resolve-feed";
import { FeedFetchError, FeedParseError } from "@/lib/rss/errors";
import type { FetchFeedResult } from "@/lib/rss/fetch";
import type { NormalizedFeed } from "@/lib/rss/types";

const ok = (finalUrl: string, body: string): FetchFeedResult => ({
  status: "ok",
  body,
  finalUrl,
  validators: { etag: null, lastModified: null },
});

const feed = (title: string): NormalizedFeed => ({
  title,
  siteUrl: null,
  description: null,
  faviconUrl: null,
  entries: [],
});

/** Bodies starting with "<rss" parse; anything else is not a feed. */
const parseFeed = (xml: string) => {
  if (!xml.startsWith("<rss")) throw new FeedParseError("Document is not an RSS or Atom feed.");
  return feed(xml.slice(5, -2));
};

const html = (...feedHrefs: string[]) =>
  `<html><head>${feedHrefs
    .map((href) => `<link rel="alternate" type="application/rss+xml" href="${href}">`)
    .join("")}</head></html>`;

describe("resolveFeed", () => {
  it("uses the address directly when it is a feed", async () => {
    const fetchFeed = vi.fn(async () => ok("https://example.test/feed.xml", "<rss Direct/>"));
    await expect(
      resolveFeed("https://example.test/feed.xml", { fetchFeed, parseFeed }),
    ).resolves.toEqual({
      feedUrl: "https://example.test/feed.xml",
      title: "Direct",
      discoveredFrom: null,
    });
    expect(fetchFeed).toHaveBeenCalledTimes(1);
  });

  it("finds the feed a web page links to", async () => {
    const fetchFeed = vi.fn(async (url: string) =>
      url === "https://example.test/"
        ? ok("https://example.test/", html("/feed.xml"))
        : ok(url, "<rss Linked/>"),
    );
    await expect(resolveFeed("https://example.test/", { fetchFeed, parseFeed })).resolves.toEqual({
      feedUrl: "https://example.test/feed.xml",
      title: "Linked",
      discoveredFrom: "https://example.test/",
    });
  });

  it("skips advertised feeds that are broken and uses the next one", async () => {
    const fetchFeed = vi.fn(async (url: string) => {
      if (url === "https://example.test/") return ok(url, html("/broken.xml", "/good.xml"));
      if (url.endsWith("/broken.xml")) throw new FeedFetchError("HTTP 404.");
      return ok(url, "<rss Good/>");
    });
    await expect(
      resolveFeed("https://example.test/", { fetchFeed, parseFeed }),
    ).resolves.toMatchObject({
      feedUrl: "https://example.test/good.xml",
    });
  });

  it("tries at most three advertised feeds", async () => {
    const fetchFeed = vi.fn(async (url: string) => {
      if (url === "https://example.test/") return ok(url, html("/1", "/2", "/3", "/4"));
      throw new FeedFetchError("HTTP 500.");
    });
    await expect(resolveFeed("https://example.test/", { fetchFeed, parseFeed })).rejects.toThrow(
      "The page links to a feed, but it could not be loaded: HTTP 500.",
    );
    expect(fetchFeed).toHaveBeenCalledTimes(4);
  });

  it("explains when a page has no feed", async () => {
    const fetchFeed = vi.fn(async () => ok("https://example.test/", html()));
    await expect(
      resolveFeed("https://example.test/", { fetchFeed, parseFeed }),
    ).rejects.toBeInstanceOf(FeedNotFoundError);
  });

  it("passes fetch errors for the address itself through", async () => {
    const fetchFeed = vi.fn(async () => {
      throw new FeedFetchError("Feed host resolves to a non-public network address.");
    });
    await expect(resolveFeed("http://10.0.0.1/", { fetchFeed, parseFeed })).rejects.toThrow(
      "non-public network address",
    );
  });
});
