import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

import { FeedFetchError } from "./errors";

// Feed URLs are user-provided and fetched from our server. Refuse anything
// that resolves to loopback, private, link-local (cloud metadata) or other
// non-public ranges so a feed cannot be used to probe internal services.
//
// Limitation: the address is checked before fetch() resolves it again, so a
// DNS-rebinding host could still switch addresses in between.
const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

export type LookupAll = (hostname: string) => Promise<{ address: string; family: number }[]>;

const defaultLookup: LookupAll = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 0) return false;
  return !blocked.check(address, version === 4 ? "ipv4" : "ipv6");
}

/** @throws FeedFetchError unless the URL is http(s) and every address it resolves to is public. */
export async function assertPublicHttpUrl(url: URL, lookup: LookupAll = defaultLookup) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FeedFetchError(`Unsupported URL scheme "${url.protocol}".`);
  }
  if (url.username || url.password) {
    throw new FeedFetchError("URLs with embedded credentials are not allowed.");
  }

  // URL keeps IPv6 literals in brackets.
  const hostname = url.hostname.replace(/^\[(.*)\]$/, "$1");
  let addresses: string[];
  if (isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      addresses = (await lookup(hostname)).map((entry) => entry.address);
    } catch {
      throw new FeedFetchError("Could not resolve the feed host.");
    }
  }

  if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
    throw new FeedFetchError("Feed host resolves to a non-public network address.");
  }
}
