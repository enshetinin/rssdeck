import Link from "next/link";

import { relativeTime } from "@/lib/relative-time";

import type { EntrySummary } from "./queries";
import { viewHref, type ViewParams } from "./view-params";

export function EntryList({
  entries,
  view,
  now,
}: {
  entries: EntrySummary[];
  view: ViewParams;
  now: Date;
}) {
  return (
    <ol role="list" className="entry-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <Link
            href={viewHref({ ...view, entryId: entry.id })}
            // Keep the list where it is; the reader pane changes instead.
            scroll={false}
            className="entry-link"
            data-read={entry.isRead || undefined}
            aria-current={entry.id === view.entryId ? "page" : undefined}
          >
            <span className="entry-link-title">
              {entry.isRead ? null : (
                <span className="entry-unread-marker">
                  <span className="yev-sr-only">Unread: </span>
                </span>
              )}
              {entry.title}
              {entry.isStarred ? (
                <>
                  <span className="yev-sr-only">, starred</span>
                  <span className="entry-star" aria-hidden="true">
                    {" ★"}
                  </span>
                </>
              ) : null}
            </span>
            <span className="entry-link-meta">
              {view.feedId ? null : <>{entry.feedName} · </>}
              <time dateTime={entry.sortAt}>{relativeTime(new Date(entry.sortAt), now)}</time>
            </span>
            {entry.excerpt ? <span className="entry-link-excerpt">{entry.excerpt}</span> : null}
          </Link>
        </li>
      ))}
    </ol>
  );
}
