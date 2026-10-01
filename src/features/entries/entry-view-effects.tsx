"use client";

import { useEffect, useRef } from "react";

import { setEntryRead } from "./actions";

const NARROW = "(max-width: 69.99rem)";

/**
 * Opening an entry marks it read (after render, never during a GET, so link
 * prefetching cannot mark anything). On narrow layouts the list is hidden
 * while reading, so focus moves to the article heading.
 */
export function EntryViewEffects({
  entryId,
  isRead,
  headingId,
}: {
  entryId: string;
  isRead: boolean;
  headingId: string;
}) {
  const markedRef = useRef<string | null>(null);

  useEffect(() => {
    if (isRead || markedRef.current === entryId) return;
    markedRef.current = entryId;
    setEntryRead(entryId, true).catch((error: unknown) => {
      markedRef.current = null;
      console.error("Marking the entry read failed:", error);
    });
  }, [entryId, isRead]);

  useEffect(() => {
    if (window.matchMedia(NARROW).matches) {
      document.getElementById(headingId)?.focus();
    }
  }, [entryId, headingId]);

  return null;
}
