const MAX_FEED_URL_LENGTH = 2048;

export type FeedUrlResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Validates what a user typed as a feed address. A missing scheme defaults to
 * https, because people paste "example.com/feed" as often as full URLs.
 */
export function normalizeFeedUrl(input: string): FeedUrlResult {
  const value = input.trim();
  if (!value) return { ok: false, error: "Enter the address of an RSS or Atom feed." };

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, error: "Enter a web address, such as https://example.com/feed.xml." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Use an address that starts with http:// or https://." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "Remove the user name and password from the address." };
  }
  if (!url.hostname.includes(".") && !url.hostname.startsWith("[")) {
    return { ok: false, error: "Enter a full web address, such as https://example.com/feed.xml." };
  }

  url.hash = "";
  if (url.href.length > MAX_FEED_URL_LENGTH) {
    return { ok: false, error: "This address is too long." };
  }
  return { ok: true, url: url.href };
}
