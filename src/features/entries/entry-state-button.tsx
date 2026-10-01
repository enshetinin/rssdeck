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
  shortcut,
}: {
  pressed: boolean;
  label: string;
  action: () => Promise<void>;
  /** Key that activates this button (see features/shortcuts). */
  shortcut?: { key: string; name: string };
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="yev-button yev-button-outline"
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut?.key}
      data-shortcut={shortcut?.name}
      aria-disabled={pending || undefined}
      onClick={() => {
        if (!pending) startTransition(action);
      }}
    >
      {label}
    </button>
  );
}
