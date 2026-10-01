import { expect, test } from "@playwright/test";

import { createTestFeed, deleteTestFeed, signIn } from "./fixtures";

test("lists feeds with their status", async ({ page }) => {
  const feed = await createTestFeed({
    last_error: "HTTP 404.",
    consecutive_failure_count: 1,
    next_fetch_at: new Date(Date.now() + 2 * 3_600_000).toISOString(),
  });
  try {
    await signIn(page, "/feeds");
    const row = page.getByRole("listitem").filter({ hasText: feed.feed_url });
    await expect(row).toContainText(feed.title ?? "");
    await expect(row).toContainText("Failing: HTTP 404.");
  } finally {
    await deleteTestFeed(feed.id);
  }
});

test("rejects an invalid feed address with an accessible error", async ({ page }) => {
  await signIn(page, "/feeds");
  const field = page.getByLabel("Feed address");

  await field.fill("ftp://example.test/feed");
  await page.getByRole("button", { name: "Add feed" }).click();

  await expect(
    page.getByText("Use an address that starts with http:// or https://."),
  ).toBeVisible();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveValue("ftp://example.test/feed");
  await expect(field).toHaveAccessibleDescription(/Use an address that starts with http/);
});

test("refuses feeds on private networks", async ({ page }) => {
  await signIn(page, "/feeds");
  await page.getByLabel("Feed address").fill("http://127.0.0.1:54321/feed");
  await page.getByRole("button", { name: "Add feed" }).click();
  await expect(page.getByText(/non-public network address/)).toBeVisible();
});

test("removes a feed after confirmation", async ({ page }) => {
  const feed = await createTestFeed();
  const name = feed.title ?? "";
  try {
    await signIn(page, "/feeds");
    const row = page.getByRole("listitem").filter({ hasText: feed.feed_url });

    await row.getByRole("button", { name: `Remove ${name}` }).click();
    const dialog = page.getByRole("dialog", { name: `Remove ${name}?` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: `Remove ${name}` }).click();
    await dialog.getByRole("button", { name: "Remove feed" }).click();
    await expect(row).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Following/ })).toBeFocused();
  } finally {
    await deleteTestFeed(feed.id);
  }
});
