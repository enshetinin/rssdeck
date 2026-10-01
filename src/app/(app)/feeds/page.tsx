import type { Metadata } from "next";

import { AddFeedForm } from "@/features/feeds/add-feed-form";
import { FeedList } from "@/features/feeds/feed-list";
import { ImportFeedsForm } from "@/features/feeds/import-feeds-form";
import { listFeeds } from "@/features/feeds/queries";

export const metadata: Metadata = { title: "Manage feeds" };

export default async function FeedsPage() {
  const feeds = await listFeeds();

  return (
    <div className="manage-page">
      <div className="manage-context">
        <h1 className="pane-title">Manage feeds</h1>
        <AddFeedForm />
        <ImportFeedsForm />
        {feeds.length > 0 ? (
          <section aria-labelledby="export-heading" className="form-stack">
            <h2 id="export-heading" className="section-heading">
              Export
            </h2>
            <p>
              <a href="/feeds/export" download>
                Download OPML
              </a>
              <span className="field-hint"> · all {feeds.length} feeds, for any other reader</span>
            </p>
          </section>
        ) : null}
      </div>
      <section aria-labelledby="feeds-heading" className="feeds-section">
        <h2 id="feeds-heading" tabIndex={-1} className="section-heading">
          Following <span className="section-count">{feeds.length}</span>
        </h2>
        <FeedList feeds={feeds} now={new Date()} />
      </section>
    </div>
  );
}
