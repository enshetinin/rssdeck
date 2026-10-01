import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { FeedParseError } from "@/lib/rss/errors";
import { parseFeed } from "@/lib/rss/parse";

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/feeds/${name}`, import.meta.url), "utf8");

describe("parseFeed: RSS 2.0", () => {
  const feed = parseFeed(fixture("rss2.xml"), "https://blog.example.test/feed.xml");

  it("reads channel metadata as plain text with resolved URLs", () => {
    expect(feed).toMatchObject({
      title: "Example & Co",
      siteUrl: "https://blog.example.test/",
      description: "Notes about things",
      faviconUrl: "https://blog.example.test/logo.png",
    });
  });

  it("normalizes a full item, keeping HTML fields raw for later sanitization", () => {
    expect(feed.entries[0]).toEqual({
      externalId: "12345",
      title: "First post",
      url: "https://blog.example.test/first",
      author: "Ada Example",
      summary: "<p>Summary</p>",
      content: "<p>Full <script>alert(1)</script> content</p>",
      publishedAt: new Date("2026-10-01T10:00:00Z"),
    });
  });

  it("falls back to the link as id, resolves relative links and drops invalid dates", () => {
    expect(feed.entries[1]).toMatchObject({
      externalId: "https://blog.example.test/second",
      url: "https://blog.example.test/second",
      summary: "<p>Escaped HTML</p>",
      publishedAt: null,
    });
  });

  it("drops non-http(s) links", () => {
    expect(feed.entries[2]).toMatchObject({ externalId: "unsafe-1", url: null });
  });

  it("removes duplicate ids and hashes entries without any id", () => {
    expect(feed.entries).toHaveLength(4);
    expect(feed.entries[3]?.externalId).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("derives the same fallback id on every parse", () => {
    const again = parseFeed(fixture("rss2.xml"), "https://blog.example.test/feed.xml");
    expect(again.entries[3]?.externalId).toBe(feed.entries[3]?.externalId);
  });
});

describe("parseFeed: Atom", () => {
  const feed = parseFeed(fixture("atom.xml"), "https://atom.example.test/feed.atom");

  it("reads feed metadata", () => {
    expect(feed).toMatchObject({
      title: "Atom Example",
      siteUrl: "https://atom.example.test/",
      description: "An Atom feed",
      faviconUrl: "https://atom.example.test/favicon.ico",
    });
  });

  it("interprets text constructs by type", () => {
    const [html, xhtml, cdata] = feed.entries;
    expect(html).toMatchObject({
      externalId: "urn:uuid:1",
      title: "Tom & Jerry",
      url: "https://atom.example.test/1",
      author: "Entry Author",
      summary: "5 &lt; 6",
      content: "<p>Escaped &amp; HTML</p>",
      publishedAt: new Date("2026-09-30T08:00:00Z"),
    });
    expect(xhtml).toMatchObject({
      url: "https://atom.example.test/2",
      author: "Feed Author",
      content: "<p>Inline <b>XHTML</b></p>",
      publishedAt: new Date("2026-10-01T09:00:00Z"),
    });
    expect(cdata).toMatchObject({ content: "<p>From CDATA</p>", url: null, publishedAt: null });
  });
});

describe("parseFeed: RSS 1.0", () => {
  it("reads items that sit beside the channel", () => {
    const feed = parseFeed(fixture("rss1.xml"), "https://rdf.example.test/rss");
    expect(feed.title).toBe("RDF Example");
    expect(feed.entries).toEqual([
      expect.objectContaining({
        externalId: "https://rdf.example.test/a",
        author: "Rdf Author",
        publishedAt: new Date("2026-10-01T07:00:00Z"),
      }),
    ]);
  });
});

describe("parseFeed: hostile and broken input", () => {
  it.each([
    ["an HTML page", "<!doctype html><html><body>Not a feed</body></html>"],
    ["plain text", "Service unavailable"],
    ["an empty body", ""],
  ])("rejects %s", (_, body) => {
    expect(() => parseFeed(body, "https://x.example.test/feed")).toThrow(FeedParseError);
  });

  it("tolerates slightly malformed feeds", () => {
    const feed = parseFeed(
      "<rss><channel><title>A & B</title><item><title>Unclosed</item></channel></rss>",
      "https://x.example.test/feed",
    );
    expect(feed.title).toBe("A & B");
  });

  it("does not expand entity bombs", () => {
    const bomb = `<?xml version="1.0"?>
<!DOCTYPE rss [
  <!ENTITY a "aaaaaaaaaaaaaaaaaaaa">
  <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">
  <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">
]>
<rss><channel><title>&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;</title></channel></rss>`;
    const feed = parseFeed(bomb, "https://x.example.test/feed");
    expect((feed.title ?? "").length).toBeLessThan(100);
  });

  it("caps the number of entries", () => {
    const items = Array.from({ length: 600 }, (_, i) => `<item><guid>${i}</guid></item>`).join("");
    const feed = parseFeed(`<rss><channel>${items}</channel></rss>`, "https://x.example.test/");
    expect(feed.entries).toHaveLength(500);
  });
});

describe("htmlToPlainText", () => {
  it("drops script and style contents, not just their tags", async () => {
    const { htmlToPlainText } = await import("@/lib/rss/text");
    expect(htmlToPlainText("<p>Hi</p><script>alert(1)</script><style>p{}</style> there")).toBe(
      "Hi there",
    );
  });
});
