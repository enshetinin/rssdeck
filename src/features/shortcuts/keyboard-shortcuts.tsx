"use client";

import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from "react";

import {
  adjacentIndex,
  isTypingTarget,
  SHORTCUTS,
  shortcutFor,
  type ShortcutAction,
} from "./shortcuts";

const STORAGE_KEY = "rssdeck:shortcuts-enabled";

const CHANGE_EVENT = "rssdeck:shortcuts-change";
let fallbackEnabled = true;

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    // Storage can be unavailable (private mode); keep the setting in memory.
    return fallbackEnabled;
  }
}

function writeEnabled(enabled: boolean) {
  fallbackEnabled = enabled;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // See readEnabled.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Also follows changes made in other tabs. */
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Activates the visible control a shortcut stands for. */
function runShortcut(action: Exclude<ShortcutAction, "show-help">) {
  if (action === "next-entry" || action === "previous-entry") {
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(".entry-list .entry-link"),
    );
    const current = links.findIndex((link) => link.getAttribute("aria-current") === "page");
    const index = adjacentIndex(links.length, current, action === "next-entry" ? 1 : -1);
    const target = index === null ? undefined : links[index];
    if (!target) return;
    target.click();
    target.scrollIntoView({ block: "nearest" });
    return;
  }
  document.querySelector<HTMLElement>(`[data-shortcut="${action}"]`)?.click();
}

/**
 * Single-key reader shortcuts and their help dialog. Character-key shortcuts
 * can be switched off here (WCAG 2.1.4); the setting is kept in this browser.
 */
export function KeyboardShortcuts() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Enabled during server rendering; the stored setting applies on the client.
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => true);
  const id = useId();
  const headingId = `${id}-heading`;

  const openHelp = useCallback(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target as HTMLElement | null)) return;
      // A modal dialog owns the keyboard while it is open.
      if (document.querySelector("dialog[open]")) return;

      const action = shortcutFor(event);
      if (!action) return;
      event.preventDefault();
      if (action === "show-help") openHelp();
      else runShortcut(action);
    };
    document.addEventListener("keydown", onKeyDown);
    // Lets tests (and styles, if ever needed) know the shortcuts are live.
    document.documentElement.dataset.shortcuts = "on";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      delete document.documentElement.dataset.shortcuts;
    };
  }, [enabled, openHelp]);

  return (
    <>
      <button
        type="button"
        className="yev-button yev-button-text"
        aria-keyshortcuts={enabled ? "?" : undefined}
        onClick={openHelp}
      >
        Keyboard shortcuts
      </button>

      <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby={headingId}>
        <div className="confirm-dialog-body">
          {/* Initial focus on the heading so reading starts at the top. */}
          <h2 id={headingId} className="section-heading" tabIndex={-1} autoFocus>
            Keyboard shortcuts
          </h2>
          <dl className="shortcut-list">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.action}>
                <dt>
                  <kbd>{shortcut.keys}</kbd>
                </dt>
                <dd>{shortcut.description}</dd>
              </div>
            ))}
          </dl>
          <div className="shortcut-toggle">
            <input
              id={`${id}-enabled`}
              type="checkbox"
              checked={enabled}
              onChange={(event) => writeEnabled(event.target.checked)}
            />
            <label htmlFor={`${id}-enabled`}>Use single-key shortcuts</label>
          </div>
          <div>
            <button
              type="button"
              className="yev-button yev-button-outline"
              onClick={() => dialogRef.current?.close()}
            >
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
