import { decodeEntities } from "./text";
import { resolveHttpUrl } from "./url";

const FEED_TYPES = new Set(["application/rss+xml", "application/atom+xml", "application/rdf+xml"]);

const LINK_TAG = /<link\b([^>]*)>/gi;
const ATTRIBUTE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/**
 * Feed URLs a web page advertises with <link rel="alternate" type="…">, in
 * document order (the site's main feed usually comes first), resolved
 * against the page URL. Only http(s) URLs are returned.
 */
export function discoverFeedLinks(html: string, pageUrl: string): string[] {
  const found: string[] = [];

  for (const [, attributeText = ""] of html.matchAll(LINK_TAG)) {
    const attributes = parseAttributes(attributeText);
    const rel = (attributes.get("rel") ?? "").toLowerCase().split(/\s+/);
    const type = (attributes.get("type") ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
    if (!rel.includes("alternate") || !FEED_TYPES.has(type)) continue;

    const href = resolveHttpUrl(decodeEntities(attributes.get("href") ?? ""), pageUrl);
    if (href && !found.includes(href)) found.push(href);
  }

  return found;
}

function parseAttributes(text: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const [, name = "", doubleQuoted, singleQuoted, unquoted] of text.matchAll(ATTRIBUTE)) {
    const key = name.toLowerCase();
    if (!attributes.has(key)) attributes.set(key, doubleQuoted ?? singleQuoted ?? unquoted ?? "");
  }
  return attributes;
}
