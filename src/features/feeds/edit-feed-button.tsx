"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import { TextField } from "@/components/text-field";

import { updateFeed, type UpdateFeedState } from "./actions";
import { REFRESH_INTERVALS, refreshIntervalLabel } from "./refresh-intervals";

const initialState: UpdateFeedState = { status: "idle" };

/**
 * Edit a feed's title and refresh interval in a native modal <dialog>
 * (yev-design Dialog contract): a form, so initial focus is its first field.
 */
export function EditFeedButton({
  feedId,
  feedName,
  title,
  refreshIntervalMinutes,
}: {
  feedId: string;
  feedName: string;
  title: string | null;
  refreshIntervalMinutes: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(updateFeed, initialState);
  const id = useId();
  const headingId = `${id}-heading`;

  useEffect(() => {
    if (state.status === "saved") dialogRef.current?.close();
  }, [state]);

  // Keep an unknown interval (set outside the app) selectable instead of silently changing it.
  const options = REFRESH_INTERVALS.some((option) => option.minutes === refreshIntervalMinutes)
    ? REFRESH_INTERVALS
    : [
        ...REFRESH_INTERVALS,
        { minutes: refreshIntervalMinutes, label: refreshIntervalLabel(refreshIntervalMinutes) },
      ];

  return (
    <>
      <button
        type="button"
        className="yev-button yev-button-text"
        onClick={() => {
          if (!dialogRef.current?.open) dialogRef.current?.showModal();
        }}
      >
        Edit<span className="yev-sr-only"> {feedName}</span>
      </button>

      <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby={headingId}>
        <form
          // Fresh fields whenever the saved values change.
          key={`${title}:${refreshIntervalMinutes}`}
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
          <div className="field">
            <label className="field-label" htmlFor={`${id}-interval`}>
              Refresh
            </label>
            <p id={`${id}-interval-hint`} className="field-hint">
              How often RSSDeck checks this feed. A change applies after its next refresh.
            </p>
            <select
              id={`${id}-interval`}
              name="refreshInterval"
              className="field-control"
              defaultValue={String(refreshIntervalMinutes)}
              aria-describedby={`${id}-interval-hint`}
            >
              {options.map((option) => (
                <option key={option.minutes} value={option.minutes}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
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
