"use client";

import { useActionState } from "react";

import { refreshFeeds, type RefreshFeedsState } from "./actions";

const initialState: RefreshFeedsState = { status: "idle" };

/**
 * Fetches every feed now. Feeds are only refreshed on request: there is no
 * scheduled job. The result is announced through a status region.
 */
export function RefreshFeedsButton() {
  const [state, formAction, pending] = useActionState(refreshFeeds, initialState);

  return (
    <form action={formAction} className="refresh-feeds">
      <button
        type="submit"
        className="yev-button yev-button-outline"
        aria-disabled={pending || undefined}
        onClick={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        {pending ? "Refreshing…" : "Refresh"}
      </button>
      {/* Always rendered, so screen readers announce the text when it appears. */}
      <p role="status" className="refresh-feeds-status">
        {pending || state.status === "idle" ? null : state.status === "error" ? (
          <span className="form-error">
            <span className="field-error-prefix">Error:</span> {state.error}
          </span>
        ) : (
          state.message
        )}
      </p>
    </form>
  );
}
