import Form from "next/form";
import { SearchIcon } from "yev-icons";

import { MAX_QUERY_LENGTH } from "./search-query";
import type { ViewParams } from "./view-params";

/**
 * A GET form, so a search is a URL like any other view: linkable, works
 * without JavaScript, and Back returns to the previous results. It searches
 * within the current filter and feed, carried as hidden fields.
 */
export function EntrySearch({ view }: { view: ViewParams }) {
  return (
    <Form action="/" role="search" className="entry-search">
      <label htmlFor="entry-search-input" className="yev-sr-only">
        Search entries
      </label>
      {view.filter !== "all" ? <input type="hidden" name="filter" value={view.filter} /> : null}
      {view.feedId ? <input type="hidden" name="feed" value={view.feedId} /> : null}
      <input
        // Remount when the URL's query changes so Back/Forward show it.
        key={view.query ?? ""}
        id="entry-search-input"
        type="search"
        name="q"
        defaultValue={view.query ?? ""}
        maxLength={MAX_QUERY_LENGTH}
        autoComplete="off"
        className="field-control"
        aria-keyshortcuts="/"
        data-shortcut="focus-search"
      />
      <button type="submit" className="yev-button yev-button-outline">
        <SearchIcon className="icon" />
        Search
      </button>
    </Form>
  );
}
