import type { OpmlFeed } from "@/lib/opml/parse-opml";

import { normalizeFeedUrl } from "./feed-url";

export const MAX_IMPORT_FEEDS = 500;

export type PreparedImport = {
  feeds: { url: string; title: string | null }[];
  invalid: number;
  duplicates: number;
  overLimit: number;
};

/** Valid, de-duplicated feeds from an OPML file, capped at MAX_IMPORT_FEEDS. */
export function prepareImport(entries: OpmlFeed[]): PreparedImport {
  const seen = new Set<string>();
  const feeds: PreparedImport["feeds"] = [];
  let invalid = 0;
  let duplicates = 0;
  let overLimit = 0;

  for (const entry of entries) {
    const normalized = normalizeFeedUrl(entry.url);
    if (!normalized.ok) {
      invalid++;
    } else if (seen.has(normalized.url)) {
      duplicates++;
    } else if (feeds.length >= MAX_IMPORT_FEEDS) {
      overLimit++;
    } else {
      seen.add(normalized.url);
      feeds.push({ url: normalized.url, title: entry.title });
    }
  }

  return { feeds, invalid, duplicates, overLimit };
}
