import { createHash } from "node:crypto";

import { XMLParser } from "fast-xml-parser";

import { FeedParseError } from "./errors";
import { escapeHtml, htmlToPlainText, rawXmlToText, truncate } from "./text";
import type { NormalizedEntry, NormalizedFeed } from "./types";
import { resolveHttpUrl } from "./url";

// Generous limits that still keep one hostile feed from bloating the database.
const MAX_ENTRIES = 500;
const MAX_EXTERNAL_ID_LENGTH = 2048;
const MAX_TITLE_LENGTH = 1000;
const MAX_AUTHOR_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_SUMMARY_LENGTH = 100_000;
const MAX_CONTENT_LENGTH = 1_000_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Keep every value a string: a numeric guid must not become a number.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  // Atom text constructs may hold escaped HTML, CDATA or inline XHTML. Keep
  // their raw markup and interpret it according to the `type` attribute.
  stopNodes: ["feed.entry.content", "feed.entry.summary"],
});

/**
 * Parses an RSS 2.0, RSS 1.0 (RDF) or Atom 1.0 document into the internal
 * representation. Relative URLs are resolved against `feedUrl`.
 *
 * @throws FeedParseError when the document is malformed or not a feed.
 */
export function parseFeed(xml: string, feedUrl: string): NormalizedFeed {
  // Parsing is deliberately lenient: real feeds are often slightly malformed
  // (unescaped "&", unclosed tags), and partial data beats none.
  let document: unknown;
  try {
    document = parser.parse(xml.replace(/^﻿/, "").trimStart());
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new FeedParseError(`Unparseable XML: ${truncate(reason, 200)}`);
  }

  if (!isRecord(document)) throw new FeedParseError("Document is not an RSS or Atom feed.");

  if (isRecord(document.rss)) return parseRss(document.rss.channel, null, feedUrl);
  if (isRecord(document["rdf:RDF"])) {
    const rdf = document["rdf:RDF"];
    return parseRss(rdf.channel, rdf.item, feedUrl);
  }
  if (isRecord(document.feed)) return parseAtom(document.feed, feedUrl);

  throw new FeedParseError("Document is not an RSS or Atom feed.");
}

// RSS 2.0 and RSS 1.0 -------------------------------------------------------

/** RSS 1.0 keeps items beside the channel rather than inside it. */
function parseRss(channelNode: unknown, rdfItems: unknown, feedUrl: string): NormalizedFeed {
  const channel = isRecord(channelNode) ? channelNode : {};
  const siteUrl = resolveHttpUrl(firstText(channel.link), feedUrl);
  const linkBase = siteUrl ?? feedUrl;
  const image = isRecord(channel.image) ? channel.image : {};

  const entries = asArray(rdfItems ?? channel.item)
    .filter(isRecord)
    .map((item): NormalizedEntry => {
      const url = resolveHttpUrl(firstText(item.link), linkBase);
      const title = plainText(firstText(item.title), MAX_TITLE_LENGTH);
      const publishedAt = parseDate(firstText(item.pubDate) ?? firstText(item["dc:date"]));
      const summary = htmlField(firstText(item.description), MAX_SUMMARY_LENGTH);
      const guid = firstText(item.guid);

      return {
        externalId: externalId(guid ?? url, [title, publishedAt?.toISOString(), summary]),
        title,
        url,
        author: plainText(
          firstText(item["dc:creator"]) ?? firstText(item.author),
          MAX_AUTHOR_LENGTH,
        ),
        summary,
        content: htmlField(firstText(item["content:encoded"]), MAX_CONTENT_LENGTH),
        publishedAt,
      };
    });

  return {
    title: plainText(firstText(channel.title), MAX_TITLE_LENGTH),
    siteUrl,
    description: plainText(firstText(channel.description), MAX_DESCRIPTION_LENGTH),
    faviconUrl: resolveHttpUrl(firstText(image.url), linkBase),
    entries: dedupeAndLimit(entries),
  };
}

// Atom 1.0 ------------------------------------------------------------------

function parseAtom(feed: Record<string, unknown>, feedUrl: string): NormalizedFeed {
  const siteUrl = resolveHttpUrl(alternateLink(feed.link), feedUrl);
  const feedAuthor = atomAuthor(feed.author);

  const entries = asArray(feed.entry)
    .filter(isRecord)
    .map((entry): NormalizedEntry => {
      const url = resolveHttpUrl(alternateLink(entry.link), feedUrl);
      const title = plainText(firstText(entry.title), MAX_TITLE_LENGTH);
      const publishedAt = parseDate(firstText(entry.published) ?? firstText(entry.updated));
      const summary = atomTextConstruct(entry.summary, MAX_SUMMARY_LENGTH);

      return {
        externalId: externalId(firstText(entry.id) ?? url, [
          title,
          publishedAt?.toISOString(),
          summary,
        ]),
        title,
        url,
        author: atomAuthor(entry.author) ?? feedAuthor,
        summary,
        content: atomTextConstruct(entry.content, MAX_CONTENT_LENGTH),
        publishedAt,
      };
    });

  return {
    title: plainText(firstText(feed.title), MAX_TITLE_LENGTH),
    siteUrl,
    description: plainText(firstText(feed.subtitle), MAX_DESCRIPTION_LENGTH),
    faviconUrl: resolveHttpUrl(firstText(feed.icon) ?? firstText(feed.logo), feedUrl),
    entries: dedupeAndLimit(entries),
  };
}

function alternateLink(links: unknown): string | null {
  for (const link of asArray(links)) {
    if (!isRecord(link)) continue;
    const rel = attribute(link, "rel") ?? "alternate";
    const type = attribute(link, "type");
    if (rel === "alternate" && (!type || type.includes("html"))) return attribute(link, "href");
  }
  return null;
}

function atomAuthor(authors: unknown): string | null {
  for (const author of asArray(authors)) {
    if (isRecord(author)) {
      const name = plainText(firstText(author.name), MAX_AUTHOR_LENGTH);
      if (name) return name;
    }
  }
  return null;
}

/** Raw stop-node markup → HTML string, according to the Atom `type` attribute. */
function atomTextConstruct(node: unknown, maxLength: number): string | null {
  const raw = firstText(node);
  if (raw === null) return null;
  const type = isRecord(node) ? attribute(node, "type") : null;

  let html: string;
  if (type === "xhtml") {
    // Inline XHTML is wrapped in a single <div>; keep its contents.
    html = raw.replace(/^\s*<div\b[^>]*>([\s\S]*)<\/div>\s*$/, "$1");
  } else if (type === "html") {
    html = rawXmlToText(raw);
  } else {
    html = escapeHtml(rawXmlToText(raw));
  }
  return htmlField(html, maxLength);
}

// Shared helpers ------------------------------------------------------------

/**
 * Stable identity for an entry: the feed's own id when it has one, otherwise a
 * hash of what we know about the entry.
 */
function externalId(candidate: string | null, fallbackParts: (string | null | undefined)[]) {
  if (candidate && candidate.length <= MAX_EXTERNAL_ID_LENGTH) return candidate;
  const source = candidate ?? fallbackParts.map((part) => part ?? "").join("\u0000");
  return `sha256:${createHash("sha256").update(source).digest("hex")}`;
}

/** Feeds sometimes repeat an id; an upsert batch must not contain duplicates. */
function dedupeAndLimit(entries: NormalizedEntry[]): NormalizedEntry[] {
  const seen = new Set<string>();
  const unique: NormalizedEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.externalId)) continue;
    seen.add(entry.externalId);
    unique.push(entry);
    if (unique.length === MAX_ENTRIES) break;
  }
  return unique;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function plainText(value: string | null, maxLength: number): string | null {
  if (value === null) return null;
  const text = truncate(htmlToPlainText(value), maxLength);
  return text || null;
}

function htmlField(value: string | null, maxLength: number): string | null {
  const html = value?.trim();
  return html ? truncate(html, maxLength) : null;
}

/** Text of an element that may be a string, an object with #text, or repeated. */
function firstText(node: unknown): string | null {
  for (const item of asArray(node)) {
    const value = typeof item === "string" ? item : isRecord(item) ? item["#text"] : null;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function attribute(node: Record<string, unknown>, name: string): string | null {
  const value = node[`@_${name}`];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
