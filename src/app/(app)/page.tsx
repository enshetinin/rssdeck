import type { Metadata } from "next";
import Link from "next/link";

import { markAllRead } from "@/features/entries/actions";
import { EntryList } from "@/features/entries/entry-list";
import { EntryReader } from "@/features/entries/entry-reader";
import { getEntry, getSidebarData, listEntries } from "@/features/entries/queries";
import { parseViewParams, viewHref, type ViewParams } from "@/features/entries/view-params";

export const metadata: Metadata = { title: "Entries" };

export default async function ReaderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const view = parseViewParams(await searchParams);
  const sidebar = await getSidebarData();
  const [page, entry] = await Promise.all([
    listEntries({
      filter: view.filter,
      feedId: view.feedId,
      before: view.before,
      keepEntryId: view.entryId,
    }),
    view.entryId ? getEntry(view.entryId) : Promise.resolve(null),
  ]);

  const scope = describeScope(view, sidebar);
  const listHref = viewHref({ ...view, entryId: null });

  return (
    <div className="reader" data-has-entry={entry ? "" : undefined}>
      <section className="entry-pane" aria-labelledby="entry-pane-heading">
        <header className="pane-header">
          <h1 id="entry-pane-heading" className="pane-title">
            {scope.title}
          </h1>
          <p className="pane-meta">{scope.meta}</p>
          {scope.canMarkAllRead ? (
            <form action={markAllRead.bind(null, view.feedId)}>
              <button type="submit" className="yev-button yev-button-text">
                Mark all as read
              </button>
            </form>
          ) : null}
        </header>

        {page.entries.length === 0 ? (
          <EmptyList view={view} hasFeeds={sidebar.feeds.length > 0} />
        ) : (
          <EntryList entries={page.entries} view={view} now={new Date()} />
        )}

        {view.before || page.older ? (
          <nav aria-label="Pages" className="pane-pagination yev-cluster">
            {view.before ? (
              <Link href={viewHref({ ...view, before: null, entryId: null })}>Newest entries</Link>
            ) : null}
            {page.older ? (
              <Link href={viewHref({ ...view, before: page.older, entryId: null })}>
                Older entries
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>

      <section className="reading-pane" aria-label="Reader">
        {entry ? (
          <EntryReader entry={entry} backHref={listHref} backLabel={scope.title} />
        ) : (
          <p className="reading-pane-empty">
            {view.entryId ? "This entry no longer exists." : "Select an entry to read it."}
          </p>
        )}
      </section>
    </div>
  );
}

function describeScope(
  view: ViewParams,
  sidebar: Awaited<ReturnType<typeof getSidebarData>>,
): { title: string; meta: string; canMarkAllRead: boolean } {
  if (view.feedId) {
    const feed = sidebar.feeds.find((candidate) => candidate.id === view.feedId);
    const unread = feed?.unread ?? 0;
    return {
      title: feed?.name ?? "Unknown feed",
      meta: `${unread} unread`,
      canMarkAllRead: unread > 0,
    };
  }
  switch (view.filter) {
    case "unread":
      return {
        title: "Unread",
        meta: `${sidebar.unread} unread`,
        canMarkAllRead: sidebar.unread > 0,
      };
    case "starred":
      return { title: "Starred", meta: `${sidebar.starred} starred`, canMarkAllRead: false };
    default:
      return {
        title: "All entries",
        meta: `${sidebar.total} entries · ${sidebar.unread} unread`,
        canMarkAllRead: sidebar.unread > 0,
      };
  }
}

function EmptyList({ view, hasFeeds }: { view: ViewParams; hasFeeds: boolean }) {
  if (!hasFeeds) {
    return (
      <div className="pane-empty yev-stack">
        <p>You do not follow any feeds yet.</p>
        <p>
          <Link href="/feeds">Add a feed</Link> to start reading.
        </p>
      </div>
    );
  }
  const message =
    view.filter === "starred"
      ? "Nothing starred yet. Star an entry to keep it here."
      : view.filter === "unread"
        ? "You are all caught up."
        : "No entries yet. They arrive with the next refresh.";
  return <p className="pane-empty">{message}</p>;
}
