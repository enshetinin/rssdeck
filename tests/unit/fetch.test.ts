import { describe, expect, it, vi } from "vitest";

import { FeedFetchError } from "@/lib/rss/errors";
import { fetchFeed, type FetchFeedOptions } from "@/lib/rss/fetch";

const noValidators = { etag: null, lastModified: null };
const allowAll = async () => {};

function options(
  handler: (url: URL, init: RequestInit) => Response | Promise<Response>,
  extra: FetchFeedOptions = {},
): FetchFeedOptions {
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
    handler(new URL(String(input)), init ?? {}),
  );
  return { fetchImpl: fetchImpl as unknown as typeof fetch, assertAllowedUrl: allowAll, ...extra };
}

describe("fetchFeed", () => {
  it("returns the body and new validators", async () => {
    const result = await fetchFeed(
      "https://feeds.example.test/rss",
      noValidators,
      options(() => new Response("<rss/>", { headers: { ETag: '"v2"' } })),
    );
    expect(result).toEqual({
      status: "ok",
      body: "<rss/>",
      finalUrl: "https://feeds.example.test/rss",
      validators: { etag: '"v2"', lastModified: null },
    });
  });

  it("sends conditional headers and handles 304", async () => {
    let sent: Headers | undefined;
    const result = await fetchFeed(
      "https://feeds.example.test/rss",
      { etag: '"v1"', lastModified: "Wed, 01 Oct 2026 10:00:00 GMT" },
      options((_, init) => {
        sent = new Headers(init.headers);
        return new Response(null, { status: 304 });
      }),
    );
    expect(sent?.get("If-None-Match")).toBe('"v1"');
    expect(sent?.get("If-Modified-Since")).toBe("Wed, 01 Oct 2026 10:00:00 GMT");
    expect(result).toEqual({
      status: "not-modified",
      validators: { etag: '"v1"', lastModified: "Wed, 01 Oct 2026 10:00:00 GMT" },
    });
  });

  it("follows redirects and checks every hop", async () => {
    const checked: string[] = [];
    const result = await fetchFeed(
      "http://feeds.example.test/old",
      noValidators,
      options(
        (url) =>
          url.pathname === "/old"
            ? new Response(null, {
                status: 301,
                headers: { Location: "https://feeds.example.test/new" },
              })
            : new Response("<rss/>"),
        {
          assertAllowedUrl: async (url) => {
            checked.push(url.href);
          },
        },
      ),
    );
    expect(result).toMatchObject({ status: "ok", finalUrl: "https://feeds.example.test/new" });
    expect(checked).toEqual(["http://feeds.example.test/old", "https://feeds.example.test/new"]);
  });

  it("refuses a redirect into a blocked network", async () => {
    const promise = fetchFeed(
      "https://feeds.example.test/rss",
      noValidators,
      options(
        () => new Response(null, { status: 302, headers: { Location: "http://169.254.169.254/" } }),
        {
          assertAllowedUrl: async (url) => {
            if (url.hostname === "169.254.169.254") throw new FeedFetchError("blocked");
          },
        },
      ),
    );
    await expect(promise).rejects.toThrow("blocked");
  });

  it("stops after too many redirects", async () => {
    const promise = fetchFeed(
      "https://feeds.example.test/loop",
      noValidators,
      options(() => new Response(null, { status: 302, headers: { Location: "/loop" } }), {
        maxRedirects: 3,
      }),
    );
    await expect(promise).rejects.toThrow("Too many redirects");
  });

  it("reports HTTP errors without the URL", async () => {
    const promise = fetchFeed(
      "https://feeds.example.test/private?token=secret",
      noValidators,
      options(() => new Response("nope", { status: 404 })),
    );
    await expect(promise).rejects.toThrow(new FeedFetchError("HTTP 404."));
  });

  it("enforces the size limit while streaming", async () => {
    const promise = fetchFeed(
      "https://feeds.example.test/huge",
      noValidators,
      options(() => new Response("x".repeat(2048)), { maxBytes: 1024 }),
    );
    await expect(promise).rejects.toThrow("Response exceeds 1024 bytes.");
  });

  it("times out", async () => {
    const promise = fetchFeed(
      "https://feeds.example.test/slow",
      noValidators,
      options(
        (_, init) =>
          new Promise<Response>((_, reject) => {
            init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
        { timeoutMs: 20 },
      ),
    );
    await expect(promise).rejects.toThrow("Timed out after 0.02s.");
  });

  it("wraps network failures", async () => {
    const promise = fetchFeed(
      "https://feeds.example.test/down",
      noValidators,
      options(() => {
        throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
      }),
    );
    await expect(promise).rejects.toThrow("Network error (ECONNREFUSED).");
  });

  it("decodes the charset declared by the XML prolog", async () => {
    const latin1 = Uint8Array.from([
      ...new TextEncoder().encode('<?xml version="1.0" encoding="ISO-8859-1"?><t>caf'),
      0xe9,
      ...new TextEncoder().encode("</t>"),
    ]);
    const result = await fetchFeed(
      "https://feeds.example.test/latin1",
      noValidators,
      options(() => new Response(latin1, { headers: { "Content-Type": "application/xml" } })),
    );
    expect(result.status === "ok" && result.body).toContain("café");
  });
});
