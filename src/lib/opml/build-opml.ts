export type OpmlExportFeed = {
  title: string | null;
  feedUrl: string;
  siteUrl: string | null;
};

/** An OPML 2.0 document other readers can import. */
export function buildOpml(feeds: OpmlExportFeed[], createdAt: Date): string {
  const outlines = feeds.map((feed) => {
    const name = feed.title ?? feed.feedUrl;
    const attributes = [
      ["type", "rss"],
      ["text", name],
      ["title", name],
      ["xmlUrl", feed.feedUrl],
      ...(feed.siteUrl ? [["htmlUrl", feed.siteUrl]] : []),
    ];
    return `    <outline ${attributes.map(([key, value]) => `${key}="${escapeXml(value ?? "")}"`).join(" ")}/>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head>",
    "    <title>RSSDeck subscriptions</title>",
    `    <dateCreated>${createdAt.toUTCString()}</dateCreated>`,
    "  </head>",
    "  <body>",
    ...outlines,
    "  </body>",
    "</opml>",
    "",
  ].join("\n");
}

function escapeXml(value: string): string {
  return (
    value
      // Characters that are not allowed in XML 1.0 at all.
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      .replace(/\n/g, "&#10;")
  );
}
