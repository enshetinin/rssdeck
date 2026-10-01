import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { createTestFeed, deleteFeedsMatching, deleteTestFeed, signIn } from "./fixtures";

test("exports subscriptions as OPML", async ({ page }) => {
  const feed = await createTestFeed({
    title: `Export & "check" ${crypto.randomUUID().slice(0, 6)}`,
  });
  try {
    await signIn(page, "/feeds");
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download OPML" }).click();
    const file = await download;

    expect(file.suggestedFilename()).toMatch(/^rssdeck-\d{4}-\d{2}-\d{2}\.opml$/);
    const xml = await readFile((await file.path()) ?? "", "utf8");
    expect(xml).toContain(`xmlUrl="${feed.feed_url}"`);
    expect(xml).toContain("Export &amp; &quot;check&quot;");
  } finally {
    await deleteTestFeed(feed.id);
  }
});

test("imports an OPML file, skipping invalid and already followed feeds", async ({ page }) => {
  const marker = `import-${crypto.randomUUID().slice(0, 8)}`;
  const existing = await createTestFeed({ feed_url: `https://${marker}-a.example.test/feed.xml` });
  const opml = `<?xml version="1.0"?>
<opml version="2.0"><body>
  <outline text="Folder">
    <outline type="rss" text="Imported A" xmlUrl="https://${marker}-a.example.test/feed.xml"/>
    <outline type="rss" text="Imported B" xmlUrl="https://${marker}-b.example.test/feed.xml"/>
  </outline>
  <outline type="rss" text="Imported C" xmlUrl="${marker}-c.example.test/rss"/>
  <outline type="rss" text="Bad" xmlUrl="ftp://${marker}.example.test/feed"/>
</body></opml>`;

  try {
    await signIn(page, "/feeds");
    await page.getByLabel("OPML file").setInputFiles({
      name: "subscriptions.opml",
      mimeType: "text/x-opml",
      buffer: Buffer.from(opml),
    });
    await page.getByRole("button", { name: "Import feeds" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Imported" })).toHaveText(
      "Imported 2 feeds. 1 already followed. 1 skipped (invalid or repeated addresses). Their entries arrive with the next refresh.",
    );
    const list = page.getByRole("list").filter({ hasText: marker });
    await expect(list.getByRole("button", { name: "Remove Imported B" })).toBeVisible();
    await expect(list.getByRole("button", { name: "Remove Imported C" })).toBeVisible();
    await expect(list.getByText(`https://${marker}-c.example.test/rss`)).toBeVisible();
  } finally {
    await deleteTestFeed(existing.id);
    await deleteFeedsMatching(marker);
  }
});

test("rejects a file that is not OPML", async ({ page }) => {
  await signIn(page, "/feeds");
  const field = page.getByLabel("OPML file");
  await field.setInputFiles({
    name: "feed.xml",
    mimeType: "text/xml",
    buffer: Buffer.from("<rss><channel/></rss>"),
  });
  await page.getByRole("button", { name: "Import feeds" }).click();

  await expect(page.getByText("Error: This file is not an OPML file.")).toBeVisible();
  await expect(field).toHaveAttribute("aria-invalid", "true");
});
