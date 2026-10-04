import { describe, expect, it } from "vitest";

import { describeFeedStatus } from "@/features/feeds/feed-status";
import { relativeTime } from "@/lib/relative-time";

const now = new Date("2026-10-01T12:00:00Z");

describe("describeFeedStatus", () => {
  const base = {
    lastSucceededAt: null,
    lastError: null,
    consecutiveFailureCount: 0,
  };

  it("is pending before the first successful fetch", () => {
    expect(describeFeedStatus(base, now)).toEqual({ kind: "pending" });
  });

  it("is healthy after a successful fetch", () => {
    expect(describeFeedStatus({ ...base, lastSucceededAt: "2026-10-01T09:00:00Z" }, now)).toEqual({
      kind: "healthy",
      updated: "3 hours ago",
    });
  });

  it("is failing while failures are recorded, even after an earlier success", () => {
    expect(
      describeFeedStatus(
        {
          lastSucceededAt: "2026-09-30T12:00:00Z",
          lastError: "HTTP 404.",
          consecutiveFailureCount: 2,
        },
        now,
      ),
    ).toEqual({ kind: "failing", error: "HTTP 404." });
  });
});

describe("relativeTime", () => {
  it.each([
    ["2026-10-01T11:59:30Z", "just now"],
    ["2026-10-01T11:45:00Z", "15 minutes ago"],
    ["2026-09-30T12:00:00Z", "yesterday"],
    ["2026-09-26T12:00:00Z", "5 days ago"],
    ["2026-10-01T12:20:00Z", "in 20 minutes"],
  ])("formats %s as %j", (date, expected) => {
    expect(relativeTime(new Date(date), now)).toBe(expected);
  });
});
