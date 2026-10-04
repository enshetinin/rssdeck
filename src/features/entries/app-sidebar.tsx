"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CloseIcon, MenuIcon } from "yev-icons";

import { signOut } from "@/features/auth/actions";
import { RefreshFeedsButton } from "@/features/feeds/refresh-feeds-button";
import { KeyboardShortcuts } from "@/features/shortcuts/keyboard-shortcuts";
import { ThemeChoice } from "@/features/theme/theme-choice";
import type { ThemePreference } from "@/features/theme/theme";

import type { SidebarData } from "./queries";
import { UnreadDocumentTitle } from "./unread-document-title";
import { parseViewParams, viewHref, type EntryFilter } from "./view-params";

const VIEWS: { filter: EntryFilter; label: string; count: (data: SidebarData) => number }[] = [
  { filter: "all", label: "All entries", count: (data) => data.total },
  { filter: "unread", label: "Unread", count: (data) => data.unread },
  { filter: "starred", label: "Starred", count: (data) => data.starred },
];

/**
 * Navigation for the whole app. A client component so the current-location
 * marker follows client-side navigation; on narrow screens it collapses into a
 * disclosure (not a dialog: the page stays usable).
 */
export function AppSidebar({
  data,
  email,
  version,
  theme,
}: {
  data: SidebarData;
  email: string | null;
  version: string;
  theme: ThemePreference;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [lastLocation, setLastLocation] = useState("");

  const view = parseViewParams(Object.fromEntries(searchParams.entries()));
  const onReader = pathname === "/";

  // Close the disclosure after navigating (state adjusted during render, not in an effect).
  const location = `${pathname}?${searchParams.toString()}`;
  if (location !== lastLocation) {
    setLastLocation(location);
    if (open) setOpen(false);
  }

  // Escape closes the open disclosure, as users expect from a menu.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="app-sidebar" data-open={open || undefined}>
      <UnreadDocumentTitle unread={data.unread} />
      <div className="app-sidebar-bar">
        <Link href="/" className="shell-wordmark">
          RSSDeck
        </Link>
        <RefreshFeedsButton />
        <button
          type="button"
          className="yev-button yev-button-outline app-sidebar-toggle"
          aria-expanded={open}
          aria-controls="app-sidebar-content"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <CloseIcon className="icon" /> : <MenuIcon className="icon" />}
          Menu
        </button>
      </div>

      <div id="app-sidebar-content" className="app-sidebar-content">
        <nav aria-label="Entries" className="sidebar-section">
          <ul role="list" className="sidebar-list">
            {VIEWS.map(({ filter, label, count }) => (
              <SidebarLink
                key={filter}
                href={viewHref({ filter })}
                current={onReader && !view.feedId && view.filter === filter}
                count={count(data)}
              >
                {label}
              </SidebarLink>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="sidebar-feeds-heading" className="sidebar-section">
          <h2 id="sidebar-feeds-heading" className="sidebar-heading">
            Feeds
          </h2>
          {data.feeds.length === 0 ? (
            <p className="sidebar-note">No feeds yet.</p>
          ) : (
            <ul role="list" className="sidebar-list">
              {data.feeds.map((feed) => (
                <SidebarLink
                  key={feed.id}
                  href={viewHref({ feedId: feed.id })}
                  current={onReader && view.feedId === feed.id}
                  count={feed.unread}
                  countLabel="unread"
                >
                  {feed.isFailing ? (
                    <>
                      <span className="sidebar-failing" aria-hidden="true">
                        !
                      </span>
                      <span className="yev-sr-only">Failing: </span>
                    </>
                  ) : null}
                  {feed.name}
                </SidebarLink>
              ))}
            </ul>
          )}
          <ul role="list" className="sidebar-list sidebar-manage">
            <SidebarLink href="/feeds" current={pathname === "/feeds"}>
              Manage feeds
            </SidebarLink>
          </ul>
        </nav>

        <div className="sidebar-account">
          <ThemeChoice initial={theme} />
          <KeyboardShortcuts />
          {email ? <p className="sidebar-email">{email}</p> : null}
          <form action={signOut}>
            <button type="submit" className="yev-button yev-button-text">
              Sign out
            </button>
          </form>
          <p className="sidebar-version">RSSDeck {version}</p>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  current,
  count,
  countLabel,
  children,
}: {
  href: string;
  current: boolean;
  count?: number;
  countLabel?: string;
  children: ReactNode;
}) {
  return (
    <li>
      <Link href={href} className="sidebar-link" aria-current={current ? "page" : undefined}>
        <span className="sidebar-link-label">{children}</span>
        {count ? (
          <span className="sidebar-count">
            {count}
            {countLabel ? <span className="yev-sr-only"> {countLabel}</span> : null}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
