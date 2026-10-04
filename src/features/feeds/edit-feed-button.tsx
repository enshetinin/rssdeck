"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { EditIcon } from "yev-icons";

import { TextField } from "@/components/text-field";

import { updateFeed, type UpdateFeedState } from "./actions";

const initialState: UpdateFeedState = { status: "idle" };

/**
 * Edit a feed's title in a native modal <dialog>
 * (yev-design Dialog contract): a form, so initial focus is its first field.
 */
export function EditFeedButton({
  feedId,
  feedName,
  title,
}: {
  feedId: string;
  feedName: string;
  title: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(updateFeed, initialState);
  const id = useId();
  const headingId = `${id}-heading`;

  useEffect(() => {
    if (state.status === "saved") dialogRef.current?.close();
  }, [state]);

  return (
    <>
      <button
        type="button"
        className="yev-button yev-button-text"
        onClick={() => {
          if (!dialogRef.current?.open) dialogRef.current?.showModal();
        }}
      >
        <EditIcon className="icon" />
        Edit<span className="yev-sr-only"> {feedName}</span>
      </button>

      <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby={headingId}>
        <form
          // Fresh fields whenever the saved title changes.
          key={title ?? ""}
          action={formAction}
          className="confirm-dialog-body"
        >
          <h2 id={headingId} className="section-heading">
            Edit {feedName}
          </h2>
          <input type="hidden" name="feedId" value={feedId} />
          <TextField
            id={`${id}-title`}
            name="title"
            label="Title"
            hint="Leave empty to use the feed's own title."
            maxLength={1000}
            autoFocus
            defaultValue={state.status === "error" ? state.title : (title ?? "")}
            error={state.status === "error" ? state.error : null}
          />
          <div className="yev-cluster">
            <button
              type="button"
              className="yev-button yev-button-outline"
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
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
