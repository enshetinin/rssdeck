"use client";

import { useEffect, useState } from "react";

import { setEntryRead } from "./actions";

const NARROW = "(max-width: 69.99rem)";

/**
 * Opening an entry marks it read (after render, never during a GET, so link
 * prefetching cannot mark anything). Only the state at the moment of opening
 * counts: marking the entry unread afterwards must stick. Render with
 * key={entryId} so each opened entry gets a fresh instance.
 *
 * On narrow layouts the list is hidden while reading, so focus moves to the
 * article heading.
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
  const [wasReadWhenOpened] = useState(isRead);

  useEffect(() => {
    if (wasReadWhenOpened) return;
    setEntryRead(entryId, true).catch((error: unknown) => {
      console.error("Marking the entry read failed:", error);
    });
  }, [entryId, wasReadWhenOpened]);

  useEffect(() => {
    if (window.matchMedia(NARROW).matches) {
      document.getElementById(headingId)?.focus();
    }
  }, [headingId]);

  return null;
}
