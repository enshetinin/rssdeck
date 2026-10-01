import { describeFeedStatus } from "./feed-status";
import type { FeedListItem } from "./queries";
import { RemoveFeedButton } from "./remove-feed-button";

export function FeedList({ feeds, now }: { feeds: FeedListItem[]; now: Date }) {
  if (feeds.length === 0) {
    return <p className="empty-note">You do not follow any feeds yet. Add one to start reading.</p>;
  }

  return (
    <ul role="list" className="feed-list">
      {feeds.map((feed) => {
        const name = feed.title ?? new URL(feed.feedUrl).hostname;
        const status = describeFeedStatus(feed, now);

        return (
          <li key={feed.id} className="feed-row">
            <div className="feed-row-main">
              <p className="feed-name">{feed.siteUrl ? <a href={feed.siteUrl}>{name}</a> : name}</p>
              <p className="feed-url">{feed.feedUrl}</p>
              {status.kind === "failing" ? (
                <p className="feed-status feed-status-failing">
                  <strong>Failing:</strong> {status.error} Next try {status.retry}.
                </p>
              ) : (
                <p className="feed-status">
                  {status.kind === "healthy"
                    ? `Updated ${status.updated}`
                    : "Waiting for the first refresh"}
                </p>
              )}
            </div>
            <RemoveFeedButton feedId={feed.id} feedName={name} />
          </li>
        );
      })}
    </ul>
  );
}
