import type { IngestionSummary } from "./run-ingestion";

/** "Checked 12 feeds. 1 failed." — the result of a refresh, in words. */
export function describeRefresh(summary: IngestionSummary): string {
  if (summary.processed === 0) return "No feeds to refresh.";
  const checked = `Checked ${summary.processed} ${summary.processed === 1 ? "feed" : "feeds"}.`;
  return summary.failed > 0 ? `${checked} ${summary.failed} failed.` : checked;
}
