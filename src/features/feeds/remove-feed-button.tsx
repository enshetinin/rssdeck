"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import { removeFeed, type RemoveFeedState } from "./actions";

const initialState: RemoveFeedState = { status: "idle" };

/**
 * Confirms in a native modal <dialog> (yev-design Dialog contract): named by
 * its heading, described by the consequence, initial focus on Cancel.
 */
export function RemoveFeedButton({ feedId, feedName }: { feedId: string; feedName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(removeFeed, initialState);
  const id = useId();
  const headingId = `${id}-heading`;
  const descriptionId = `${id}-description`;

  const submittedRef = useRef(false);

  // A successful removal re-renders the list without this row, unmounting
  // the button and dialog. Move focus somewhere meaningful instead of <body>.
  useEffect(
    () => () => {
      if (submittedRef.current) document.getElementById("feeds-heading")?.focus();
    },
    [],
  );

  return (
    <>
      <button
        type="button"
        className="yev-button yev-button-text"
        onClick={() => {
          if (!dialogRef.current?.open) dialogRef.current?.showModal();
        }}
      >
        Remove<span className="yev-sr-only"> {feedName}</span>
      </button>

      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
      >
        <form
          action={formAction}
          className="confirm-dialog-body"
          onSubmit={() => {
            submittedRef.current = true;
          }}
        >
          <h2 id={headingId} className="section-heading">
            Remove {feedName}?
          </h2>
          <p id={descriptionId}>
            Its entries and your read and starred marks for them are deleted. This cannot be undone.
          </p>
          {state.status === "error" ? (
            <p role="alert" className="form-error">
              <span className="field-error-prefix">Error:</span> {state.error}
            </p>
          ) : null}
          <input type="hidden" name="feedId" value={feedId} />
          <div className="yev-cluster">
            <button
              type="button"
              className="yev-button yev-button-outline"
              autoFocus
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="yev-button"
              aria-disabled={pending || undefined}
              onClick={(event) => {
                if (pending) event.preventDefault();
              }}
            >
              {pending ? "Removing…" : "Remove feed"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
