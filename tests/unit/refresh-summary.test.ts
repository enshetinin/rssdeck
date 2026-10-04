import { describe, expect, it } from "vitest";

import { describeRefresh } from "@/features/ingestion/refresh-summary";

const summary = (processed: number, failed = 0) => ({
  processed,
  updated: processed - failed,
  "not-modified": 0,
  failed,
});

describe("describeRefresh", () => {
  it("says when there was nothing to refresh", () => {
    expect(describeRefresh(summary(0))).toBe("No feeds to refresh.");
  });

  it("counts checked feeds", () => {
    expect(describeRefresh(summary(1))).toBe("Checked 1 feed.");
    expect(describeRefresh(summary(12))).toBe("Checked 12 feeds.");
  });

  it("mentions failures only when there are some", () => {
    expect(describeRefresh(summary(12, 2))).toBe("Checked 12 feeds. 2 failed.");
  });
});
