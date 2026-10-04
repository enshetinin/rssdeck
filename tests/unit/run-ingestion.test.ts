import { describe, expect, it, vi } from "vitest";

import { runIngestion } from "@/features/ingestion/run-ingestion";
import type { FeedRepository, IngestionFeed } from "@/features/ingestion/types";
import { FeedFetchError } from "@/lib/rss/errors";
import type { FetchFeedResult } from "@/lib/rss/fetch";
import type { NormalizedFeed } from "@/lib/rss/types";

const now = new Date("2026-10-01T12:00:00Z");

function feed(id: string, overrides: Partial<IngestionFeed> = {}): IngestionFeed {
  return {
    id,
    feedUrl: `https://feeds.example.test/${id}`,
    title: null,
    validators: { etag: null, lastModified: null },
    consecutiveFailureCount: 0,
    ...overrides,
  };
}

const parsed: NormalizedFeed = {
  title: "Parsed",
  siteUrl: "https://feeds.example.test/",
  description: null,
  faviconUrl: null,
  entries: [
    {
      externalId: "1",
      title: "Entry",
      url: null,
      author: null,
      summary: null,
      content: null,
      publishedAt: null,
    },
  ],
};

function fakeRepository(feeds: IngestionFeed[]) {
  return {
    listFeeds: vi.fn<FeedRepository["listFeeds"]>(async () => feeds),
    saveEntries: vi.fn<FeedRepository["saveEntries"]>(async () => {}),
    recordSuccess: vi.fn<FeedRepository["recordSuccess"]>(async () => {}),
    recordFailure: vi.fn<FeedRepository["recordFailure"]>(async () => {}),
    pruneEntries: vi.fn<FeedRepository["pruneEntries"]>(async () => 0),
  } satisfies FeedRepository;
}

const silentLogger = { info: () => {}, error: () => {} };

describe("runIngestion", () => {
  it("stores entries and metadata for an updated feed", async () => {
    const repository = fakeRepository([feed("a")]);
    const summary = await runIngestion({
      repository,
      fetchFeed: async () => ({
        status: "ok",
        body: "<rss/>",
        finalUrl: "https://feeds.example.test/a",
        validators: { etag: '"v2"', lastModified: null },
      }),
      parseFeed: () => parsed,
      now: () => now,
      logger: silentLogger,
    });

    expect(summary).toEqual({ processed: 1, updated: 1, "not-modified": 0, failed: 0 });
    expect(repository.saveEntries).toHaveBeenCalledWith("a", parsed.entries, now);
    expect(repository.recordSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), {
      now,
      validators: { etag: '"v2"', lastModified: null },
      metadata: {
        title: "Parsed",
        siteUrl: "https://feeds.example.test/",
        description: null,
        faviconUrl: null,
        entryCount: 1,
      },
    });
  });

  it("records not-modified feeds without parsing", async () => {
    const repository = fakeRepository([feed("a")]);
    const parseFeed = vi.fn(() => parsed);
    const summary = await runIngestion({
      repository,
      fetchFeed: async () => ({
        status: "not-modified",
        validators: { etag: '"v1"', lastModified: null },
      }),
      parseFeed,
      now: () => now,
      logger: silentLogger,
    });

    expect(summary["not-modified"]).toBe(1);
    expect(parseFeed).not.toHaveBeenCalled();
    expect(repository.saveEntries).not.toHaveBeenCalled();
    expect(repository.recordSuccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ metadata: null }),
    );
  });

  it("keeps going when individual feeds fail", async () => {
    const repository = fakeRepository([
      feed("ok-1"),
      feed("broken", { consecutiveFailureCount: 2 }),
      feed("crashes"),
      feed("ok-2"),
    ]);
    const okResult: FetchFeedResult = {
      status: "ok",
      body: "<rss/>",
      finalUrl: "https://feeds.example.test/",
      validators: { etag: null, lastModified: null },
    };

    const summary = await runIngestion({
      repository,
      fetchFeed: async (url) => {
        if (url.endsWith("/broken")) throw new FeedFetchError("HTTP 500.");
        if (url.endsWith("/crashes")) throw new Error("connection string leaked here");
        return okResult;
      },
      parseFeed: () => parsed,
      now: () => now,
      concurrency: 2,
      logger: silentLogger,
    });

    expect(summary).toEqual({ processed: 4, updated: 2, "not-modified": 0, failed: 2 });
    expect(repository.recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ id: "broken" }),
      { now, message: "HTTP 500." },
    );
    // Unexpected errors are not stored verbatim.
    expect(repository.recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ id: "crashes" }),
      expect.objectContaining({ message: "Internal error while ingesting this feed." }),
    );
  });

  it("counts a feed as failed when saving its entries fails", async () => {
    const repository = fakeRepository([feed("a")]);
    repository.saveEntries.mockRejectedValueOnce(new Error("Saving entries failed: timeout"));

    const summary = await runIngestion({
      repository,
      fetchFeed: async () => ({
        status: "ok",
        body: "<rss/>",
        finalUrl: "https://feeds.example.test/a",
        validators: { etag: '"v2"', lastModified: null },
      }),
      parseFeed: () => parsed,
      now: () => now,
      logger: silentLogger,
    });

    expect(summary.failed).toBe(1);
    // Validators are not advanced, so the next run fetches the full feed again.
    expect(repository.recordSuccess).not.toHaveBeenCalled();
  });

  it("survives a failure to record a failure", async () => {
    const repository = fakeRepository([feed("a"), feed("b")]);
    repository.recordFailure.mockRejectedValue(new Error("db down"));

    const summary = await runIngestion({
      repository,
      fetchFeed: async () => {
        throw new FeedFetchError("Network error.");
      },
      parseFeed: () => parsed,
      now: () => now,
      logger: silentLogger,
    });

    expect(summary).toEqual({ processed: 2, updated: 0, "not-modified": 0, failed: 2 });
  });

  it("handles at most the batch limit of feeds", async () => {
    const repository = fakeRepository([]);
    await runIngestion({
      repository,
      fetchFeed: async () => {
        throw new Error("not called");
      },
      parseFeed: () => parsed,
      now: () => now,
      logger: silentLogger,
    });
    expect(repository.listFeeds).toHaveBeenCalledWith(500);
  });
});
