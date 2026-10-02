"use client";

import { useActionState } from "react";
import { PlusIcon } from "yev-icons";

import { TextField } from "@/components/text-field";

import { addFeed, type AddFeedState } from "./actions";

const initialState: AddFeedState = { status: "idle" };

export function AddFeedForm() {
  const [state, formAction, pending] = useActionState(addFeed, initialState);

  return (
    <form action={formAction} className="form-stack" noValidate aria-labelledby="add-feed-heading">
      <h2 id="add-feed-heading" className="section-heading">
        Add a feed
      </h2>
      <TextField
        // Remount after each result so the field shows what was submitted
        // (React resets uncontrolled forms after an action).
        key={state.status === "error" ? `error:${state.url}:${state.error}` : state.status}
        id="feed-url"
        name="url"
        label="Feed or website address"
        hint="An RSS or Atom feed, or a website that links to one, such as blog.example.com."
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        required
        defaultValue={state.status === "error" ? state.url : ""}
        error={state.status === "error" ? state.error : null}
      />
      <div>
        <button
          type="submit"
          className="yev-button"
          aria-disabled={pending || undefined}
          onClick={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          {pending ? (
            "Looking for the feed…"
          ) : (
            <>
              <PlusIcon className="icon" />
              Add feed
            </>
          )}
        </button>
      </div>
      <p role="status" className="form-status">
        {state.status === "added"
          ? `${state.discovered ? "Found and added" : "Added"} ${state.title}. Its entries arrive with the next refresh.`
          : ""}
      </p>
    </form>
  );
}
