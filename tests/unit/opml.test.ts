import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MAX_IMPORT_FEEDS, prepareImport } from "@/features/feeds/prepare-import";
import { buildOpml } from "@/lib/opml/build-opml";
import { OpmlParseError, parseOpml } from "@/lib/opml/parse-opml";

const fixture = readFileSync(
  new URL("../fixtures/opml/subscriptions.opml", import.meta.url),
  "utf8",
);

describe("parseOpml", () => {
  it("flattens folders and reads titles and URLs in file order", () => {
    expect(parseOpml(fixture)).toEqual([
      { url: "https://rust.example.test/feed.xml", title: "Rust & Friends" },
      { url: "https://text.example.test/atom", title: "Only text" },
      { url: "https://deep.example.test/rss", title: "Deep" },
      { url: "ftp://bad.example.test/feed", title: "Bad scheme" },
      { url: "https://rust.example.test/feed.xml#again", title: "Duplicate" },
      { url: "top.example.test/feed", title: "Top level" },
    ]);
  });

  it.each([
    ["an RSS feed", "<rss><channel/></rss>"],
    ["HTML", "<html><body>Hi</body></html>"],
    ["plain text", "not xml"],
  ])("rejects %s", (_, content) => {
    expect(() => parseOpml(content)).toThrow(OpmlParseError);
  });

  it("accepts an OPML file without subscriptions", () => {
    expect(parseOpml('<opml version="2.0"><head/><body/></opml>')).toEqual([]);
  });
});

describe("prepareImport", () => {
  it("keeps valid, unique feeds and counts the rest", () => {
    expect(prepareImport(parseOpml(fixture))).toEqual({
      feeds: [
        { url: "https://rust.example.test/feed.xml", title: "Rust & Friends" },
        { url: "https://text.example.test/atom", title: "Only text" },
        { url: "https://deep.example.test/rss", title: "Deep" },
        { url: "https://top.example.test/feed", title: "Top level" },
      ],
      invalid: 1,
      duplicates: 1,
      overLimit: 0,
    });
  });

  it("caps the number of feeds per import", () => {
    const entries = Array.from({ length: MAX_IMPORT_FEEDS + 3 }, (_, i) => ({
      url: `https://feed${i}.example.test/rss`,
      title: null,
    }));
    const prepared = prepareImport(entries);
    expect(prepared.feeds).toHaveLength(MAX_IMPORT_FEEDS);
    expect(prepared.overLimit).toBe(3);
  });
});

describe("buildOpml", () => {
  it("escapes titles and URLs and round-trips through parseOpml", () => {
    const xml = buildOpml(
      [
        {
          title: `Tom & "Jerry" <3 'quotes'`,
          feedUrl: "https://example.test/feed?a=1&b=2",
          siteUrl: "https://example.test/",
        },
        { title: null, feedUrl: "https://untitled.example.test/rss", siteUrl: null },
      ],
      new Date("2026-10-01T12:00:00Z"),
    );

    expect(xml).toContain('xmlUrl="https://example.test/feed?a=1&amp;b=2"');
    expect(xml).toContain("Tom &amp; &quot;Jerry&quot; &lt;3 &apos;quotes&apos;");
    expect(xml).toContain("<dateCreated>Thu, 01 Oct 2026 12:00:00 GMT</dateCreated>");
    expect(parseOpml(xml)).toEqual([
      { url: "https://example.test/feed?a=1&b=2", title: `Tom & "Jerry" <3 'quotes'` },
      { url: "https://untitled.example.test/rss", title: "https://untitled.example.test/rss" },
    ]);
  });
});
