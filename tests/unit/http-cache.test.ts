import { describe, expect, it } from "vitest";

import { cacheValidatorsFromResponse, conditionalRequestHeaders } from "@/lib/rss/http-cache";

describe("conditionalRequestHeaders", () => {
  it("sends both validators when present", () => {
    expect(
      conditionalRequestHeaders({ etag: '"abc"', lastModified: "Wed, 01 Oct 2026 10:00:00 GMT" }),
    ).toEqual({
      "If-None-Match": '"abc"',
      "If-Modified-Since": "Wed, 01 Oct 2026 10:00:00 GMT",
    });
  });

  it("omits missing or blank validators", () => {
    expect(conditionalRequestHeaders({ etag: null, lastModified: "  " })).toEqual({});
  });
});

describe("cacheValidatorsFromResponse", () => {
  const previous = { etag: '"old"', lastModified: "Tue, 30 Sep 2026 10:00:00 GMT" };

  it("replaces validators on a full response", () => {
    const response = { status: 200, headers: new Headers({ ETag: '"new"' }) };
    expect(cacheValidatorsFromResponse(response, previous)).toEqual({
      etag: '"new"',
      lastModified: null,
    });
  });

  it("keeps previous validators the server did not resend on 304", () => {
    const response = { status: 304, headers: new Headers({ ETag: '"new"' }) };
    expect(cacheValidatorsFromResponse(response, previous)).toEqual({
      etag: '"new"',
      lastModified: previous.lastModified,
    });
  });
});
