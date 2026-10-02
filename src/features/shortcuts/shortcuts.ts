// Single-key shortcuts for the reader. Each one activates an existing,
// visible control (found by its data-shortcut attribute), so a shortcut always
// does exactly what clicking would do.

export type ShortcutAction =
  | "next-entry"
  | "previous-entry"
  | "toggle-star"
  | "toggle-read"
  | "open-original"
  | "focus-search"
  | "show-help";

export const SHORTCUTS: { keys: string; action: ShortcutAction; description: string }[] = [
  { keys: "j", action: "next-entry", description: "Next entry" },
  { keys: "k", action: "previous-entry", description: "Previous entry" },
  { keys: "s", action: "toggle-star", description: "Star or unstar the open entry" },
  { keys: "m", action: "toggle-read", description: "Mark the open entry read or unread" },
  { keys: "o", action: "open-original", description: "Open the original in a new tab" },
  { keys: "/", action: "focus-search", description: "Search entries" },
  { keys: "?", action: "show-help", description: "Show keyboard shortcuts" },
];

const BY_KEY = new Map(SHORTCUTS.map((shortcut) => [shortcut.keys, shortcut.action]));

export type KeyInput = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing: boolean;
};

/** The action for a key press, or null if it is not a shortcut. */
export function shortcutFor(input: KeyInput): ShortcutAction | null {
  // Leave browser and OS combinations alone; "?" needs Shift, so Shift is allowed.
  if (input.ctrlKey || input.metaKey || input.altKey || input.isComposing) return null;
  return BY_KEY.get(input.key) ?? null;
}

type TargetLike = { tagName?: string; isContentEditable?: boolean } | null;

/** Keys typed into a field are text, not commands. */
export function isTypingTarget(target: TargetLike): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

/** The entry to open for j/k, given the list's entry ids and the open one. */
export function adjacentIndex(
  count: number,
  currentIndex: number,
  direction: 1 | -1,
): number | null {
  if (count === 0) return null;
  if (currentIndex === -1) return direction === 1 ? 0 : null;
  const next = currentIndex + direction;
  return next >= 0 && next < count ? next : null;
}
