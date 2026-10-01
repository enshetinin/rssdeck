import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";
import { appVersionLabel } from "@/lib/app-version";

describe("appVersionLabel", () => {
  it("defaults to the package.json version", () => {
    expect(appVersionLabel(undefined, undefined)).toBe(packageJson.version);
  });

  it("adds the short deployed commit", () => {
    expect(appVersionLabel("0.2.0", "36e7d2404b1a9c0e5f7d1e2a3b4c5d6e7f8a9b0c")).toBe(
      "0.2.0 · 36e7d24",
    );
  });

  it("ignores values that are not a commit hash", () => {
    expect(appVersionLabel("0.2.0", "")).toBe("0.2.0");
    expect(appVersionLabel("0.2.0", "<script>")).toBe("0.2.0");
  });
});
