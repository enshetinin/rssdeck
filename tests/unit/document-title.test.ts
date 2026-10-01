import { describe, expect, it } from "vitest";

import { withUnreadCount } from "@/features/entries/document-title";

describe("withUnreadCount", () => {
  it("prefixes the unread count", () => {
    expect(withUnreadCount("All entries", 21)).toBe("(21) All entries");
  });

  it("leaves the title alone when nothing is unread", () => {
    expect(withUnreadCount("All entries", 0)).toBe("All entries");
  });
});
