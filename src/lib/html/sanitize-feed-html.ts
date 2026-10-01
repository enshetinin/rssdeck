import "server-only";

import sanitizeHtml from "sanitize-html";

// Feed HTML is untrusted. Keep structure and media, drop everything that can
// run code, restyle the page or reach out on its own (scripts, styles, forms,
// iframes, event handlers, javascript: URLs).
const ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "caption",
  "cite",
  "code",
  "dd",
  "del",
  "dfn",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "picture",
  "pre",
  "q",
  "s",
  "samp",
  "small",
  "source",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "u",
  "ul",
];

/**
 * Sanitizes feed-provided HTML for rendering inside the reader. Relative
 * links and images are resolved against the entry's URL; links open in a new
 * tab without passing a referrer or a handle to this page.
 */
export function sanitizeFeedHtml(html: string, baseUrl: string | null): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      // target, rel, loading, decoding and referrerpolicy are always
      // overwritten by transformTags below, so a feed cannot choose them.
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding", "referrerpolicy"],
      source: ["srcset", "media", "type"],
      time: ["datetime"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      abbr: ["title"],
      ol: ["start", "reversed"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"], source: ["http", "https"] },
    allowProtocolRelative: false,
    // Drop the element and its text for these; everything else unknown is unwrapped.
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "embed"],
    transformTags: {
      a: (tagName, attribs) => {
        const href = resolve(attribs.href, baseUrl);
        return {
          tagName,
          attribs: {
            ...attribs,
            ...(href ? { href } : {}),
            target: "_blank",
            rel: "noopener noreferrer nofollow",
          },
        };
      },
      img: (tagName, attribs) => {
        const src = resolve(attribs.src, baseUrl);
        return {
          tagName,
          attribs: {
            ...attribs,
            ...(src ? { src } : {}),
            loading: "lazy",
            decoding: "async",
            referrerpolicy: "no-referrer",
          },
        };
      },
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  });
}

function resolve(value: string | undefined, baseUrl: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value, baseUrl ?? undefined).href;
  } catch {
    return null;
  }
}
