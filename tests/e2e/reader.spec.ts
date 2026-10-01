import { expect, test } from "@playwright/test";

import { createTestEntries, createTestFeed, deleteTestFeed, signIn } from "./fixtures";

test.describe("reader", () => {
  let feed: Awaited<ReturnType<typeof createTestFeed>>;

  test.beforeEach(async () => {
    feed = await createTestFeed();
    await createTestEntries(feed.id, 3);
  });

  test.afterEach(async () => {
    await deleteTestFeed(feed.id);
  });

  test("opening an entry shows sanitized content and marks it read", async ({ page }) => {
    await signIn(page, "/");
    await page.goto(`/?feed=${feed.id}`);

    await expect(page.getByRole("heading", { level: 1, name: feed.title ?? "" })).toBeVisible();
    // The tab shows the total unread count first.
    await expect(page).toHaveTitle(/^\(\d+\) .+ · RSSDeck$/);
    // The list pane is hidden while reading on narrow screens; check its text.
    await expect(page.locator(".pane-meta")).toHaveText("3 unread");

    await page.getByRole("link", { name: /Entry 1/ }).click();
    const article = page.getByRole("article");
    await expect(article.getByRole("heading", { name: "Entry 1" })).toBeVisible();
    await expect(article.getByText("Summary of entry 1.")).toBeVisible();
    expect(await page.evaluate(() => "__pwned" in window)).toBe(false);

    // The list pane is hidden while reading on narrow screens; check its text.
    await expect(page.locator(".pane-meta")).toHaveText("2 unread");
    await expect(article.getByRole("button", { name: "Read" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("starring an entry puts it in Starred", async ({ page }) => {
    await signIn(page, "/");
    await page.goto(`/?feed=${feed.id}`);
    await page.getByRole("link", { name: /Entry 2/ }).click();

    const star = page.getByRole("article").getByRole("button", { name: "Starred" });
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");

    await page.goto(`/?filter=starred&feed=${feed.id}`);
    await expect(page.getByRole("link", { name: /Entry 2\s*, starred/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Entry 1/ })).toHaveCount(0);
  });

  test("mark all as read asks first, then clears the feed's unread count", async ({ page }) => {
    await signIn(page, "/");
    await page.goto(`/?feed=${feed.id}`);
    const meta = page.locator(".pane-meta");

    await page.getByRole("button", { name: "Mark all as read" }).click();
    const dialog = page.getByRole("dialog", { name: "Mark 3 entries as read?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`Every unread entry in ${feed.title} is marked as read.`);
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(meta).toHaveText("3 unread");

    await page.getByRole("button", { name: "Mark all as read" }).click();
    await dialog.getByRole("button", { name: "Mark as read" }).click();
    await expect(meta).toHaveText("0 unread");
    await expect(page.getByRole("button", { name: "Mark all as read" })).toHaveCount(0);
  });

  test("narrow screens show the list or the entry, with a way back", async ({ page, isMobile }) => {
    test.skip(!isMobile, "The single-pane layout is the mobile one.");
    await signIn(page, "/");
    await page.goto(`/?feed=${feed.id}`);

    await page.getByRole("link", { name: /Entry 3/ }).click();
    await expect(page.getByRole("heading", { name: "Entry 3" })).toBeFocused();
    await expect(page.getByRole("heading", { level: 1 })).toBeHidden();

    await page.getByRole("link", { name: `← ${feed.title}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: feed.title ?? "" })).toBeVisible();
  });
});
