import { relativeTime } from "@/lib/relative-time";

export type FeedStatusInput = {
  lastSucceededAt: string | null;
  lastError: string | null;
  consecutiveFailureCount: number;
};

export type FeedStatus =
  { kind: "pending" } | { kind: "healthy"; updated: string } | { kind: "failing"; error: string };

/** What the feed list says about a feed's last fetch, in words. */
export function describeFeedStatus(feed: FeedStatusInput, now: Date): FeedStatus {
  if (feed.consecutiveFailureCount > 0) {
    return { kind: "failing", error: feed.lastError ?? "Unknown error." };
  }
  if (feed.lastSucceededAt) {
    return { kind: "healthy", updated: relativeTime(new Date(feed.lastSucceededAt), now) };
  }
  return { kind: "pending" };
}
