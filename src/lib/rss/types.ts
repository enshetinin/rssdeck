// Internal representation of a parsed feed, independent of RSS vs. Atom and of
// how it is persisted. Parsers produce these; the persistence layer maps them
// to database rows.

export type NormalizedFeed = {
  title: string | null;
  siteUrl: string | null;
  description: string | null;
  faviconUrl: string | null;
  entries: NormalizedEntry[];
};

export type NormalizedEntry = {
  /** Stable identity within the feed: RSS guid, Atom id, or a derived fallback. */
  externalId: string;
  title: string | null;
  url: string | null;
  author: string | null;
  /** Untrusted feed HTML/text. Sanitize before rendering. */
  summary: string | null;
  /** Untrusted feed HTML/text. Sanitize before rendering. */
  content: string | null;
  publishedAt: Date | null;
};

/** HTTP cache validators remembered from the previous successful fetch. */
export type CacheValidators = {
  etag: string | null;
  lastModified: string | null;
};
