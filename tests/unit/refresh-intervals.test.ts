import { describe, expect, it } from "vitest";

import { isRefreshInterval, refreshIntervalLabel } from "@/features/feeds/refresh-intervals";

describe("refresh intervals", () => {
  it.each([60, 180, 360, 720, 1440])("accepts %i minutes", (minutes) => {
    expect(isRefreshInterval(minutes)).toBe(true);
  });

  it.each([0, 5, 30, 61, 10080, Number.NaN])("rejects %s minutes", (minutes) => {
    expect(isRefreshInterval(minutes)).toBe(false);
  });

  it("labels known and unknown intervals", () => {
    expect(refreshIntervalLabel(60)).toBe("Every hour");
    expect(refreshIntervalLabel(1440)).toBe("Once a day");
    expect(refreshIntervalLabel(120)).toBe("Every 2 hours");
    expect(refreshIntervalLabel(15)).toBe("Every 15 minutes");
  });
});
