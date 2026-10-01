// Error messages are stored in feeds.last_error and logged, so they must never
// contain the feed URL (private feeds often embed tokens) or response bodies.

export class FeedFetchError extends Error {
  override name = "FeedFetchError";
}

export class FeedParseError extends Error {
  override name = "FeedParseError";
}
