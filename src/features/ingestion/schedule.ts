const MAX_BACKOFF_MINUTES = 24 * 60;

/**
 * When to fetch a feed next. Healthy feeds follow their refresh interval;
 * failing feeds back off exponentially, capped at a day (or the interval, if
 * that is longer).
 */
export function nextFetchAt(now: Date, intervalMinutes: number, consecutiveFailures: number): Date {
  const backoffMinutes =
    consecutiveFailures === 0
      ? intervalMinutes
      : Math.min(
          intervalMinutes * 2 ** Math.min(consecutiveFailures, 16),
          Math.max(MAX_BACKOFF_MINUTES, intervalMinutes),
        );
  return new Date(now.getTime() + backoffMinutes * 60_000);
}
