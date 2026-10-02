// Turns what the user typed into a PostgreSQL tsquery. Only letters and
// digits survive, so no tsquery operator from the input ever reaches the
// database; every word must match, as a prefix ("kube" finds "kubernetes").

const MAX_QUERY_LENGTH = 200;
const MAX_TERMS = 8;
const WORD = /[\p{L}\p{N}]+/gu;

/** The search text as it is kept in the URL and shown back, or null if blank. */
export function normalizeSearchQuery(value: string | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
  return text ? text : null;
}

/** A prefix tsquery for the text, or null when it has no searchable words. */
export function toPrefixTsQuery(text: string): string | null {
  const terms = (text.match(WORD) ?? []).slice(0, MAX_TERMS);
  return terms.length > 0 ? terms.map((term) => `${term}:*`).join(" & ") : null;
}
