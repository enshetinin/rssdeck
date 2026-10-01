import Link from "next/link";

import { sanitizeFeedHtml } from "@/lib/html/sanitize-feed-html";

import { setEntryRead, setEntryStarred } from "./actions";
import { EntryStateButton } from "./entry-state-button";
import { EntryViewEffects } from "./entry-view-effects";
import type { EntryDetail } from "./queries";
import { viewHref } from "./view-params";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

export function EntryReader({
  entry,
  backHref,
  backLabel,
}: {
  entry: EntryDetail;
  backHref: string;
  backLabel: string;
}) {
  const headingId = `entry-${entry.id}-title`;
  const html = entry.html ? sanitizeFeedHtml(entry.html, entry.url) : null;

  return (
    <article className="reader-article" aria-labelledby={headingId}>
      <EntryViewEffects entryId={entry.id} isRead={entry.isRead} headingId={headingId} />
      <p className="reader-back">
        <Link href={backHref}>← {backLabel}</Link>
      </p>

      <header className="reader-header">
        <p className="reader-feed">
          <Link href={viewHref({ feedId: entry.feedId })}>{entry.feedName}</Link>
        </p>
        <h2 id={headingId} tabIndex={-1} className="reader-title">
          {entry.title}
        </h2>
        <p className="reader-meta">
          {[entry.author, entry.publishedAt ? dateFormat.format(new Date(entry.publishedAt)) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="yev-cluster reader-actions">
          <EntryStateButton
            pressed={entry.isStarred}
            label="Starred"
            action={setEntryStarred.bind(null, entry.id, !entry.isStarred)}
          />
          <EntryStateButton
            pressed={entry.isRead}
            label="Read"
            action={setEntryRead.bind(null, entry.id, !entry.isRead)}
          />
          {entry.url ? (
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="reader-original"
            >
              Open original<span className="yev-sr-only"> (opens in a new tab)</span>
              <span aria-hidden="true"> ↗</span>
            </a>
          ) : null}
        </div>
      </header>

      {html ? (
        // Sanitized above with an allowlist; see src/lib/html/sanitize-feed-html.ts.
        <div className="reader-content yev-prose" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="reader-empty">This entry has no text. Open the original to read it.</p>
      )}
    </article>
  );
}
