import { describe, expect, it } from "vitest";

import { sanitizeFeedHtml } from "@/lib/html/sanitize-feed-html";

const base = "https://blog.example.test/posts/1";

describe("sanitizeFeedHtml", () => {
  it.each([
    ["script elements", "<p>ok</p><script>alert(1)</script>", "<p>ok</p>"],
    ["event handlers", '<p onclick="alert(1)">ok</p>', "<p>ok</p>"],
    ["inline styles", '<p style="position:fixed">ok</p>', "<p>ok</p>"],
    ["style elements", "<style>body{display:none}</style><p>ok</p>", "<p>ok</p>"],
    ["iframes", '<iframe src="https://evil.example.test"></iframe><p>ok</p>', "<p>ok</p>"],
    ["forms", '<form action="https://evil.example.test"><input name="x"></form>', ""],
    ["svg", '<svg onload="alert(1)"><circle /></svg><p>ok</p>', "<p>ok</p>"],
  ])("removes %s", (_, input, expected) => {
    expect(sanitizeFeedHtml(input, base)).toBe(expected);
  });

  it("removes javascript: and data: links but keeps the text", () => {
    expect(sanitizeFeedHtml('<a href="javascript:alert(1)">x</a>', base)).toBe(
      '<a target="_blank" rel="noopener noreferrer nofollow">x</a>',
    );
    expect(sanitizeFeedHtml('<a href="data:text/html,hi">x</a>', base)).toBe(
      '<a target="_blank" rel="noopener noreferrer nofollow">x</a>',
    );
  });

  it("resolves relative links and forces safe link behavior", () => {
    expect(sanitizeFeedHtml('<a href="../about" target="_self" rel="opener">About</a>', base)).toBe(
      '<a href="https://blog.example.test/about" target="_blank" rel="noopener noreferrer nofollow">About</a>',
    );
  });

  it("resolves images, loads them lazily without a referrer, and drops unsafe ones", () => {
    expect(sanitizeFeedHtml('<img src="/a.png" alt="A" onerror="alert(1)">', base)).toBe(
      '<img src="https://blog.example.test/a.png" alt="A" loading="lazy" decoding="async" referrerpolicy="no-referrer" />',
    );
    expect(sanitizeFeedHtml('<img src="javascript:alert(1)">', base)).toBe("");
  });

  it("keeps ordinary article structure", () => {
    const html =
      "<h2>Title</h2><p><strong>Bold</strong> and <code>code</code></p><pre><code>x</code></pre>";
    expect(sanitizeFeedHtml(html, base)).toBe(html);
  });
});
