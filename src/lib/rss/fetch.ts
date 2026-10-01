import { FeedFetchError } from "./errors";
import { cacheValidatorsFromResponse, conditionalRequestHeaders } from "./http-cache";
import { assertPublicHttpUrl } from "./network-guard";
import type { CacheValidators } from "./types";

export type FetchFeedOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  fetchImpl?: typeof fetch;
  /** Rejects URLs that must not be fetched. Defaults to the public-network guard. */
  assertAllowedUrl?: (url: URL) => Promise<void>;
};

export type FetchFeedResult =
  | { status: "not-modified"; validators: CacheValidators }
  | { status: "ok"; body: string; finalUrl: string; validators: CacheValidators };

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const REQUEST_HEADERS = {
  "User-Agent": "RSSDeck/0.1 (self-hosted feed reader)",
  Accept:
    "application/rss+xml, application/atom+xml, application/rdf+xml;q=0.9, application/xml;q=0.8, text/xml;q=0.8, */*;q=0.5",
};

/**
 * Fetches a feed document with a timeout, a size limit, conditional request
 * headers and manually followed redirects (each hop re-checked by the guard).
 *
 * @throws FeedFetchError with a message that is safe to store and log.
 */
export async function fetchFeed(
  feedUrl: string,
  validators: CacheValidators,
  options: FetchFeedOptions = {},
): Promise<FetchFeedResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    fetchImpl = fetch,
    assertAllowedUrl = assertPublicHttpUrl,
  } = options;

  const signal = AbortSignal.timeout(timeoutMs);
  let url = parseUrl(feedUrl);

  try {
    for (let redirects = 0; ; redirects++) {
      await assertAllowedUrl(url);

      const response = await fetchImpl(url, {
        headers: { ...REQUEST_HEADERS, ...conditionalRequestHeaders(validators) },
        redirect: "manual",
        signal,
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        await response.body?.cancel();
        if (redirects >= maxRedirects) {
          throw new FeedFetchError(`Too many redirects (more than ${maxRedirects}).`);
        }
        const location = response.headers.get("location");
        if (!location)
          throw new FeedFetchError(`HTTP ${response.status} without a Location header.`);
        url = parseUrl(location, url);
        continue;
      }

      if (response.status === 304) {
        await response.body?.cancel();
        return {
          status: "not-modified",
          validators: cacheValidatorsFromResponse(response, validators),
        };
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new FeedFetchError(`HTTP ${response.status}.`);
      }

      const bytes = await readLimited(response, maxBytes);
      return {
        status: "ok",
        body: decodeBody(bytes, response.headers.get("content-type")),
        finalUrl: url.href,
        validators: cacheValidatorsFromResponse(response, validators),
      };
    }
  } catch (error) {
    if (error instanceof FeedFetchError) throw error;
    if (signal.aborted) throw new FeedFetchError(`Timed out after ${timeoutMs / 1000}s.`);
    throw new FeedFetchError(`Network error${networkErrorCode(error)}.`);
  }
}

function parseUrl(value: string, base?: URL): URL {
  try {
    return new URL(value, base);
  } catch {
    throw new FeedFetchError("Invalid feed URL.");
  }
}

async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (declaredLength > maxBytes) {
    await response.body?.cancel();
    throw new FeedFetchError(`Response exceeds ${maxBytes} bytes.`);
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new FeedFetchError(`Response exceeds ${maxBytes} bytes.`);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Charset from Content-Type, then the XML declaration, then UTF-8. */
function decodeBody(bytes: Uint8Array, contentType: string | null): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 200));
  const charset =
    /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1] ??
    /^\s*<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(head)?.[1] ??
    "utf-8";

  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** undici reports the useful part (ENOTFOUND, ECONNREFUSED, ...) on `cause`. */
function networkErrorCode(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined;
  const code =
    typeof cause === "object" && cause !== null && "code" in cause ? cause.code : undefined;
  return typeof code === "string" ? ` (${code})` : "";
}
