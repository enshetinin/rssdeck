"use client";

import { useEffect } from "react";

import { withUnreadCount } from "./document-title";

const COUNT_PREFIX = /^\(\d+\) /;

/**
 * Prefixes the tab title with the unread count. Done on the client because a
 * dynamic generateMetadata is streamed by Next.js, which logs an error every
 * time a navigation aborts that stream. Re-applied whenever Next.js replaces
 * the title (route changes).
 */
export function UnreadDocumentTitle({ unread }: { unread: number }) {
  useEffect(() => {
    const apply = () => {
      const title = withUnreadCount(document.title.replace(COUNT_PREFIX, ""), unread);
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [unread]);

  return null;
}
