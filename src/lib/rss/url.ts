const MAX_URL_LENGTH = 2048;

/**
 * Resolves a feed-provided URL against a base and keeps it only if it is
 * http(s). Anything else (javascript:, data:, mailto:, garbage) becomes null.
 */
export function resolveHttpUrl(value: string | null, base: string): string | null {
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value.trim(), base);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const href = url.href;
  return href.length <= MAX_URL_LENGTH ? href : null;
}
