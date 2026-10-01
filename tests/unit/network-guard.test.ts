import { describe, expect, it } from "vitest";

import { FeedFetchError } from "@/lib/rss/errors";
import { assertPublicHttpUrl, isPublicAddress, type LookupAll } from "@/lib/rss/network-guard";

const resolvesTo =
  (...addresses: string[]): LookupAll =>
  async () =>
    addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));

describe("isPublicAddress", () => {
  it.each(["93.184.215.14", "2606:2800:21f:cb07:6820:80da:af6b:8b2c"])("allows %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
});

describe("assertPublicHttpUrl", () => {
  it("accepts a public host", async () => {
    await expect(
      assertPublicHttpUrl(new URL("https://feeds.example.test/rss"), resolvesTo("93.184.215.14")),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["a private literal IP", "http://192.168.0.10/feed", resolvesTo()],
    ["a bracketed IPv6 loopback", "http://[::1]/feed", resolvesTo()],
    ["a host resolving to loopback", "https://evil.example.test/", resolvesTo("127.0.0.1")],
    [
      "a host with any private address",
      "https://mixed.example.test/",
      resolvesTo("93.184.215.14", "10.0.0.1"),
    ],
    ["a non-http scheme", "file:///etc/passwd", resolvesTo()],
    ["embedded credentials", "https://user:pw@feeds.example.test/", resolvesTo("93.184.215.14")],
  ])("rejects %s", async (_, url, lookup) => {
    await expect(assertPublicHttpUrl(new URL(url), lookup)).rejects.toBeInstanceOf(FeedFetchError);
  });

  it("reports DNS failures as fetch errors", async () => {
    const failing: LookupAll = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(
      assertPublicHttpUrl(new URL("https://missing.example.test/"), failing),
    ).rejects.toThrow("Could not resolve the feed host.");
  });
});
