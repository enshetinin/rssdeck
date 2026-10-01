import type { RetentionPolicy } from "./types";

/**
 * How long entries are kept after they leave their feed. Starred entries are
 * kept forever; entries still in the feed are never pruned (they would come
 * back as new on the next fetch).
 */
export const RETENTION_POLICY: RetentionPolicy = {
  readDays: 30,
  unreadDays: 90,
};
