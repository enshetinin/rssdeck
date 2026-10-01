import type { CacheValidators } from "./types";

/** Conditional request headers so unchanged feeds answer 304 Not Modified. */
export function conditionalRequestHeaders(validators: CacheValidators): Record<string, string> {
  const headers: Record<string, string> = {};
  const etag = validators.etag?.trim();
  const lastModified = validators.lastModified?.trim();

  if (etag) headers["If-None-Match"] = etag;
  if (lastModified) headers["If-Modified-Since"] = lastModified;

  return headers;
}

/**
 * Validators to store after a fetch. A 304 carries no new body, so keep the
 * previous validators for any the server did not resend.
 */
export function cacheValidatorsFromResponse(
  response: Pick<Response, "status" | "headers">,
  previous: CacheValidators,
): CacheValidators {
  const etag = response.headers.get("etag")?.trim() || null;
  const lastModified = response.headers.get("last-modified")?.trim() || null;

  if (response.status === 304) {
    return {
      etag: etag ?? previous.etag,
      lastModified: lastModified ?? previous.lastModified,
    };
  }

  return { etag, lastModified };
}
