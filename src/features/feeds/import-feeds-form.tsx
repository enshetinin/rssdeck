"use client";

import { useActionState } from "react";

import { importFeeds, type ImportFeedsState } from "./actions";

const initialState: ImportFeedsState = { status: "idle" };

function summary(state: Extract<ImportFeedsState, { status: "imported" }>): string {
  const parts = [`Imported ${state.added} ${state.added === 1 ? "feed" : "feeds"}.`];
  if (state.alreadyFollowed) parts.push(`${state.alreadyFollowed} already followed.`);
  if (state.skipped) parts.push(`${state.skipped} skipped (invalid or repeated addresses).`);
  if (state.overLimit) parts.push(`${state.overLimit} not imported: the limit is 500 per file.`);
  if (state.added) parts.push("Their entries arrive with the next refresh.");
  return parts.join(" ");
}

/** File field wired per the yev-design Field contract (label, hint, error). */
export function ImportFeedsForm() {
  const [state, formAction, pending] = useActionState(importFeeds, initialState);
  const error = state.status === "error" ? state.error : null;
  const describedBy = ["import-opml-hint", error ? "import-opml-error" : null]
    .filter(Boolean)
    .join(" ");

  return (
    <form action={formAction} className="form-stack" aria-labelledby="import-heading">
      <h2 id="import-heading" className="section-heading">
        Import
      </h2>
      <div className="field">
        <label className="field-label" htmlFor="import-opml">
          OPML file
        </label>
        <p id="import-opml-hint" className="field-hint">
          Export it from your current reader. Up to 500 feeds and 512 KB; folders are flattened.
        </p>
        <input
          id="import-opml"
          name="opml"
          type="file"
          accept=".opml,.xml,text/x-opml,text/xml,application/xml"
          required
          className="field-file"
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        />
        {error ? (
          <p id="import-opml-error" className="field-error">
            <span className="field-error-prefix">Error:</span> {error}
          </p>
        ) : null}
      </div>
      <div>
        <button
          type="submit"
          className="yev-button yev-button-outline"
          aria-disabled={pending || undefined}
          onClick={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          {pending ? "Importing…" : "Import feeds"}
        </button>
      </div>
      <p role="status" className="form-status">
        {state.status === "imported" ? summary(state) : ""}
      </p>
    </form>
  );
}
