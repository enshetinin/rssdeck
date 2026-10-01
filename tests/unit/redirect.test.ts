import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/features/auth/redirect";

describe("safeRedirectPath", () => {
  it.each(["/", "/feeds", "/feeds?tab=failing"])("keeps the same-origin path %s", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example.test/",
    "//evil.example.test/",
    "/\\evil.example.test",
    "feeds",
    "javascript:alert(1)",
    "/feeds\n",
    "",
    null,
    undefined,
    ["/feeds"],
  ])("falls back to / for %j", (value) => {
    expect(safeRedirectPath(value)).toBe("/");
  });
});
