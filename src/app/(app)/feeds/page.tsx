import type { Metadata } from "next";

import { AddFeedForm } from "@/features/feeds/add-feed-form";
import { FeedList } from "@/features/feeds/feed-list";
import { listFeeds } from "@/features/feeds/queries";

export const metadata: Metadata = { title: "Manage feeds" };

export default async function FeedsPage() {
  const feeds = await listFeeds();

  return (
    <div className="manage-page">
      <div className="manage-context yev-stack">
        <h1 className="pane-title">Manage feeds</h1>
        <AddFeedForm />
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
