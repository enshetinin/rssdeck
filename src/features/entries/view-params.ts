import { normalizeSearchQuery } from "./search-query";

// The reader's state lives in the URL (/?filter=unread&feed=…&q=…&entry=…), so
// every view is linkable, works without client JavaScript and survives a
// reload. Values are validated here before they reach a database query.

export type EntryFilter = "all" | "unread" | "starred";

export type Cursor = { sortAt: string; id: string };

export type ViewParams = {
  filter: EntryFilter;
  feedId: string | null;
  /** Search text; narrows the filter and feed above rather than replacing them. */
  query: string | null;
  entryId: string | null;
  before: Cursor | null;
};

type SearchParams = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseViewParams(searchParams: SearchParams): ViewParams {
  const filter = single(searchParams.filter);
  const feed = single(searchParams.feed);
  const entry = single(searchParams.entry);

  return {
    filter: filter === "unread" || filter === "starred" ? filter : "all",
    feedId: isUuid(feed) ? feed : null,
    query: normalizeSearchQuery(single(searchParams.q)),
    entryId: isUuid(entry) ? entry : null,
    before: parseCursor(single(searchParams.before)),
  };
}

/** Cursor format: "<ISO timestamp>_<uuid>". Anything else is ignored. */
export function parseCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  const separator = value.lastIndexOf("_");
  const sortAt = value.slice(0, separator);
  const id = value.slice(separator + 1);
  return separator > 0 && ISO_TIMESTAMP.test(sortAt) && isUuid(id) ? { sortAt, id } : null;
}

export function formatCursor(cursor: Cursor): string {
  return `${cursor.sortAt}_${cursor.id}`;
}

/** Builds a reader URL; omitted values are dropped, defaults are left out. */
export function viewHref(params: Partial<ViewParams>): string {
  const search = new URLSearchParams();
  if (params.filter && params.filter !== "all") search.set("filter", params.filter);
  if (params.feedId) search.set("feed", params.feedId);
  if (params.query) search.set("q", params.query);
  if (params.before) search.set("before", formatCursor(params.before));
  if (params.entryId) search.set("entry", params.entryId);
  const query = search.toString();
  return query ? `/?${query}` : "/";
}
