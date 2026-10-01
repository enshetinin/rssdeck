import { XMLParser } from "fast-xml-parser";

import { htmlToPlainText, truncate } from "@/lib/rss/text";

export class OpmlParseError extends Error {
  override name = "OpmlParseError";
}

export type OpmlFeed = {
  /** As written in the file; validate before use. */
  url: string;
  title: string | null;
};

const MAX_DEPTH = 10;
const MAX_TITLE_LENGTH = 1000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) => name === "outline",
});

/**
 * Subscriptions from an OPML file, in file order. Folders (outlines without
 * a feed URL) are flattened, since RSSDeck has none.
 *
 * @throws OpmlParseError when the file is not OPML.
 */
export function parseOpml(xml: string): OpmlFeed[] {
  let document: unknown;
  try {
    document = parser.parse(xml.replace(/^﻿/, "").trimStart());
  } catch {
    throw new OpmlParseError("This file is not valid OPML.");
  }

  const opml = isRecord(document) ? document.opml : undefined;
  if (!isRecord(opml)) throw new OpmlParseError("This file is not an OPML file.");
  const body = isRecord(opml.body) ? opml.body : {};

  const feeds: OpmlFeed[] = [];
  collect(body.outline, 0, feeds);
  return feeds;
}

function collect(outlines: unknown, depth: number, feeds: OpmlFeed[]) {
  if (depth > MAX_DEPTH || !Array.isArray(outlines)) return;

  for (const outline of outlines) {
    if (!isRecord(outline)) continue;
    // Readers disagree on case: xmlUrl is the spec, xmlurl and XMLURL exist.
    const url = attribute(outline, "xmlurl");
    if (url) {
      const title = attribute(outline, "title") ?? attribute(outline, "text");
      const plain = title ? truncate(htmlToPlainText(title), MAX_TITLE_LENGTH) : "";
      feeds.push({ url, title: plain || null });
    }
    collect(outline.outline, depth + 1, feeds);
  }
}

function attribute(node: Record<string, unknown>, name: string): string | null {
  for (const [key, value] of Object.entries(node)) {
    if (key.toLowerCase() === `@_${name}` && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
