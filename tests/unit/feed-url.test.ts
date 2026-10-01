import { describe, expect, it } from "vitest";

import { normalizeFeedUrl } from "@/features/feeds/feed-url";

describe("normalizeFeedUrl", () => {
  it.each([
    ["https://example.com/feed.xml", "https://example.com/feed.xml"],
    ["  http://example.com/rss  ", "http://example.com/rss"],
    ["example.com/feed", "https://example.com/feed"],
    ["https://example.com/feed#section", "https://example.com/feed"],
    ["HTTPS://Example.COM/Feed", "https://example.com/Feed"],
  ])("accepts %j", (input, expected) => {
    expect(normalizeFeedUrl(input)).toEqual({ ok: true, url: expected });
  });

  it.each([
    ["", "Enter the address of an RSS or Atom feed."],
    ["ftp://example.com/feed", "Use an address that starts with http:// or https://."],
    ["javascript:alert(1)", "Use an address that starts with http:// or https://."],
    ["https://user:secret@example.com/feed", "Remove the user name and password from the address."],
    ["localhost/feed", "Enter a full web address, such as https://example.com/feed.xml."],
    ["https://exa mple.com", "Enter a web address, such as https://example.com/feed.xml."],
    [`https://example.com/${"a".repeat(2100)}`, "This address is too long."],
  ])("rejects %j", (input, error) => {
    expect(normalizeFeedUrl(input)).toEqual({ ok: false, error });
  });
});
