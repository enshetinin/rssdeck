const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  // Common in feed titles even though they are HTML, not XML, entities.
  nbsp: " ",
};

const ENTITY_PATTERN = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi;

export function decodeEntities(value: string): string {
  return value.replace(ENTITY_PATTERN, (match, entity: string) => {
    if (entity[0] === "#") {
      const codePoint =
        entity[1] === "x" || entity[1] === "X"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return XML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function isValidCodePoint(codePoint: number): boolean {
  return (
    Number.isInteger(codePoint) &&
    codePoint > 0 &&
    codePoint <= 0x10ffff &&
    !(codePoint >= 0xd800 && codePoint <= 0xdfff)
  );
}

const CDATA_PATTERN = /<!\[CDATA\[([\s\S]*?)\]\]>/g;

/**
 * Converts the raw (unparsed) inner XML of an element into its text value:
 * CDATA sections are taken verbatim and everything else is entity-decoded.
 */
export function rawXmlToText(raw: string): string {
  let result = "";
  let lastIndex = 0;
  for (const match of raw.matchAll(CDATA_PATTERN)) {
    result += decodeEntities(raw.slice(lastIndex, match.index));
    result += match[1];
    lastIndex = match.index + match[0].length;
  }
  return result + decodeEntities(raw.slice(lastIndex));
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Plain text for titles and names, which feeds often deliver as HTML. */
export function htmlToPlainText(value: string): string {
  const withoutCode = value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  return decodeEntities(withoutCode.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}
