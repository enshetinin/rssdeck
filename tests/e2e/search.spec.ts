import { expect, test } from "@playwright/test";

import { createTestEntries, createTestFeed, deleteTestFeed, signIn } from "./fixtures";

test.describe("search", () => {
  let feed: Awaited<ReturnType<typeof createTestFeed>>;

  test.beforeEach(async () => {
    feed = await createTestFeed();
    await createTestEntries(feed.id, 3);
  });

  test.afterEach(async () => {
    await deleteTestFeed(feed.id);
  });

  test("searches within the open feed, by word prefix", async ({ page }) => {
    await signIn(page, "/");
    await page.goto(`/?feed=${feed.id}`);

    const entries = page.locator(".entry-list .entry-link");
    await expect(entries).toHaveCount(3);

    // "/" jumps to the field; "summ" finds "Summary" as a prefix.
    await expect(page.locator("html")).toHaveAttribute("data-shortcuts", "on");
    await page.keyboard.press("/");
    const field = page.getByRole("searchbox", { name: "Search entries" });
    await expect(field).toBeFocused();
    await field.fill("summ 2");
    await field.press("Enter");

    await expect(page).toHaveURL(new RegExp(`feed=${feed.id}.*q=summ\\+2`));
    await expect(page.locator(".pane-meta")).toContainText("Matching “summ 2”");
    await expect(entries).toHaveCount(1);
    await expect(entries).toContainText("Entry 2");

    await field.fill("nothing-like-this");
    await field.press("Enter");
    await expect(page.getByText("No entries match “nothing-like-this”.")).toBeVisible();

    await page.getByRole("link", { name: "Clear search" }).click();
    await expect(entries).toHaveCount(3);
    await expect(field).toHaveValue("");
  });
});
