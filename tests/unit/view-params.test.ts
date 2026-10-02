import { describe, expect, it } from "vitest";

import { parseCursor, parseViewParams, viewHref } from "@/features/entries/view-params";

const feedId = "22222222-2222-4222-8222-222222222222";
const entryId = "33333333-3333-4333-8333-333333333333";

describe("parseViewParams", () => {
  it("defaults to all entries", () => {
    expect(parseViewParams({})).toEqual({
      filter: "all",
      feedId: null,
      query: null,
      entryId: null,
      before: null,
    });
  });

  it("reads valid values", () => {
    expect(
      parseViewParams({
        filter: "unread",
        feed: feedId,
        q: "  rust   async ",
        entry: entryId,
        before: `2026-10-01T10:00:00.123+00:00_${entryId}`,
      }),
    ).toEqual({
      filter: "unread",
      feedId,
      query: "rust async",
      entryId,
      before: { sortAt: "2026-10-01T10:00:00.123+00:00", id: entryId },
    });
  });

  it("ignores invalid or injected values", () => {
    expect(
      parseViewParams({
        filter: "everything",
        feed: "1 or 1=1",
        q: "   ",
        entry: [entryId, "x"],
        before: `2026-10-01),id.gt.(0_${entryId}`,
      }),
    ).toEqual({ filter: "all", feedId: null, query: null, entryId, before: null });
  });
});

describe("parseCursor", () => {
  it.each([undefined, "", "nope", `_${entryId}`, "2026-10-01T10:00:00Z_not-a-uuid"])(
    "rejects %j",
    (value) => {
      expect(parseCursor(value)).toBeNull();
    },
  );
});

describe("viewHref", () => {
  it("omits defaults", () => {
    expect(viewHref({ filter: "all" })).toBe("/");
  });

  it("encodes every part", () => {
    expect(
      viewHref({
        filter: "starred",
        feedId,
        query: "café & co",
        entryId,
        before: { sortAt: "2026-10-01T10:00:00+00:00", id: entryId },
      }),
    ).toBe(
      `/?filter=starred&feed=${feedId}&q=caf%C3%A9+%26+co&before=2026-10-01T10%3A00%3A00%2B00%3A00_${entryId}&entry=${entryId}`,
    );
  });
});
