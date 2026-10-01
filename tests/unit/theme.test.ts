import { describe, expect, it } from "vitest";

import { parseThemePreference, themeAttribute } from "@/features/theme/theme";

describe("theme preference", () => {
  it.each([
    ["light", "light"],
    ["dark", "dark"],
    [undefined, "system"],
    ["", "system"],
    ["sepia", "system"],
  ] as const)("parses %j as %s", (value, expected) => {
    expect(parseThemePreference(value)).toBe(expected);
  });

  it("only forces a theme for light and dark", () => {
    expect(themeAttribute("light")).toBe("light");
    expect(themeAttribute("dark")).toBe("dark");
    expect(themeAttribute("system")).toBeUndefined();
  });
});
