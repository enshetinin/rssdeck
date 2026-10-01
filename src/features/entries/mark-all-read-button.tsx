"use client";

import { useId, useRef, useTransition } from "react";

import { markAllRead } from "./actions";

/**
 * "Mark all as read" with a confirmation in a native modal <dialog>
 * (yev-design Dialog contract): it cannot be undone, so initial focus is on
 * Cancel.
 */
export function MarkAllReadButton({
  feedId,
  scopeLabel,
  unread,
}: {
  feedId: string | null;
  scopeLabel: string;
  unread: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();
  const headingId = `${id}-heading`;
  const descriptionId = `${id}-description`;
  const entries = `${unread} ${unread === 1 ? "entry" : "entries"}`;

  return (
    <>
      <button
        type="button"
        className="yev-button yev-button-text"
        onClick={() => {
          if (!dialogRef.current?.open) dialogRef.current?.showModal();
        }}
      >
        Mark all as read
      </button>

      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
      >
        <div className="confirm-dialog-body">
          <h2 id={headingId} className="section-heading">
            Mark {entries} as read?
          </h2>
          <p id={descriptionId}>
            Every unread entry in {scopeLabel} is marked as read. This cannot be undone.
          </p>
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
              type="button"
              className="yev-button"
              aria-disabled={pending || undefined}
              onClick={() => {
                if (pending) return;
                startTransition(async () => {
                  await markAllRead(feedId);
                  dialogRef.current?.close();
                });
              }}
            >
              {pending ? "Marking…" : "Mark as read"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
