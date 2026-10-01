"use client";

import { useTransition } from "react";

/**
 * A toggle (aria-pressed) that runs a server action. Works as a normal
 * button; while the action runs it stays focusable but inert.
 */
export function EntryStateButton({
  pressed,
  label,
  action,
}: {
  pressed: boolean;
  label: string;
  action: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="yev-button yev-button-outline"
      aria-pressed={pressed}
      aria-disabled={pending || undefined}
      onClick={() => {
        if (!pending) startTransition(action);
      }}
    >
      {label}
    </button>
  );
}
