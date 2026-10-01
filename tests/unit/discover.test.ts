import { describe, expect, it } from "vitest";

import { discoverFeedLinks } from "@/lib/rss/discover";

const page = "https://blog.example.test/posts/hello";

describe("discoverFeedLinks", () => {
  it("finds RSS and Atom alternates in document order, resolved against the page", () => {
    const html = `<!doctype html><html><head>
      <link rel="stylesheet" href="/style.css">
      <link rel="alternate" type="application/rss+xml" title="Posts" href="/feed.xml">
      <link rel='alternate' type='application/atom+xml' href='https://blog.example.test/atom.xml'/>
      <link href="/comments.xml" type="application/rss+xml" rel="alternate">
    </head><body></body></html>`;
    expect(discoverFeedLinks(html, page)).toEqual([
      "https://blog.example.test/feed.xml",
      "https://blog.example.test/atom.xml",
      "https://blog.example.test/comments.xml",
    ]);
  });

  it("is case-insensitive, tolerates extra rel tokens, parameters and unquoted values", () => {
    const html = `<LINK REL="Alternate Home" TYPE="Application/RSS+XML; charset=utf-8" HREF=feed.rss>`;
    expect(discoverFeedLinks(html, page)).toEqual(["https://blog.example.test/posts/feed.rss"]);
  });

  it("decodes entities in href and removes duplicates", () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="/feed?format=rss&amp;lang=en">
      <link rel="alternate" type="application/rss+xml" href="/feed?format=rss&lang=en">`;
    expect(discoverFeedLinks(html, page)).toEqual([
      "https://blog.example.test/feed?format=rss&lang=en",
    ]);
  });

  it("ignores other link types and non-http URLs", () => {
    const html = `
      <link rel="alternate" hreflang="es" href="/es/">
      <link rel="alternate" type="text/html" href="/print">
      <link rel="icon" type="application/rss+xml" href="/not-alternate.xml">
      <link rel="alternate" type="application/rss+xml" href="javascript:alert(1)">
      <link rel="alternate" type="application/atom+xml">`;
    expect(discoverFeedLinks(html, page)).toEqual([]);
  });

  it("returns nothing for a page without feeds", () => {
    expect(discoverFeedLinks("<html><body>Hi</body></html>", page)).toEqual([]);
  });
});
