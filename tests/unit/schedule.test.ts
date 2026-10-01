import { describe, expect, it } from "vitest";

import { nextFetchAt } from "@/features/ingestion/schedule";

const now = new Date("2026-10-01T00:00:00Z");
const minutesAfterNow = (date: Date) => (date.getTime() - now.getTime()) / 60_000;

describe("nextFetchAt", () => {
  it("uses the refresh interval for healthy feeds", () => {
    expect(minutesAfterNow(nextFetchAt(now, 60, 0))).toBe(60);
  });

  it("backs off exponentially after failures", () => {
    expect(minutesAfterNow(nextFetchAt(now, 60, 1))).toBe(120);
    expect(minutesAfterNow(nextFetchAt(now, 60, 3))).toBe(480);
  });

  it("caps the backoff at a day", () => {
    expect(minutesAfterNow(nextFetchAt(now, 60, 50))).toBe(24 * 60);
  });

  it("never schedules sooner than a long interval", () => {
    expect(minutesAfterNow(nextFetchAt(now, 7 * 24 * 60, 5))).toBe(7 * 24 * 60);
  });
});
