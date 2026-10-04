import { describe, expect, it } from "vitest";

import { normalizeSearchQuery, toPrefixTsQuery } from "@/features/entries/search-query";

describe("normalizeSearchQuery", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeSearchQuery("  rust \n  async  ")).toBe("rust async");
  });

  it.each([undefined, "", "   "])("treats %j as no search", (value) => {
    expect(normalizeSearchQuery(value)).toBeNull();
  });

  it("caps the length", () => {
    expect(normalizeSearchQuery("a".repeat(500))).toHaveLength(200);
  });

  it("does not end in a space when the cap falls on one", () => {
    expect(normalizeSearchQuery(`${"a".repeat(199)} b`)).toBe("a".repeat(199));
  });
});

describe("toPrefixTsQuery", () => {
  it("requires every word, each as a prefix", () => {
    expect(toPrefixTsQuery("kube operator")).toBe("kube:* & operator:*");
  });

  it("keeps letters and digits from any script", () => {
    expect(toPrefixTsQuery("árbol 2026 東京")).toBe("árbol:* & 2026:* & 東京:*");
  });

  it("drops tsquery operators and punctuation from the input", () => {
    expect(toPrefixTsQuery("a & !b | (c:*) <-> 'd'")).toBe("a:* & b:* & c:* & d:*");
  });

  it("returns null when nothing is searchable", () => {
    expect(toPrefixTsQuery("!!! ---")).toBeNull();
  });

  it("limits the number of terms", () => {
    expect(toPrefixTsQuery("a b c d e f g h i j")?.split(" & ")).toHaveLength(8);
  });
});
