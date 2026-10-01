import { expect, test } from "@playwright/test";

import { createTestEntries, createTestFeed, deleteTestFeed, signIn } from "./fixtures";

test.describe("keyboard shortcuts", () => {
  test.skip(({ isMobile }) => isMobile, "Keyboard shortcuts are a desktop concern.");

  let feed: Awaited<ReturnType<typeof createTestFeed>> | undefined;

  test.beforeEach(async ({ context }) => {
    feed = await createTestFeed();
    await createTestEntries(feed.id, 3);
    // Entry URLs point at a fictional host; answer locally instead of the network.
    await context.route("https://e2e.example.test/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>Original</title>" }),
    );
  });

  test.afterEach(async () => {
    if (feed) await deleteTestFeed(feed.id);
    feed = undefined;
  });

  test("j and k move between entries; s, m and o act on the open one", async ({ page }) => {
    await signIn(page, "/");
    await page.goto(`/?feed=${feed?.id}`);
    await expect(page.locator("html[data-shortcuts=on]")).toHaveCount(1);
    const article = page.getByRole("article");

    await page.keyboard.press("j");
    await expect(article.getByRole("heading", { name: "Entry 1" })).toBeVisible();
    await page.keyboard.press("j");
    await expect(article.getByRole("heading", { name: "Entry 2" })).toBeVisible();
    await page.keyboard.press("k");
    await expect(article.getByRole("heading", { name: "Entry 1" })).toBeVisible();

    const star = article.getByRole("button", { name: "Starred" });
    await page.keyboard.press("s");
    await expect(star).toHaveAttribute("aria-pressed", "true");

    const read = article.getByRole("button", { name: "Read" });
    await expect(read).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("m");
    await expect(read).toHaveAttribute("aria-pressed", "false");

    // Marking unread sticks, also on an entry opened a second time.
    await page.reload();
    await expect(read).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("html[data-shortcuts=on]")).toHaveCount(1);

    const popup = page.waitForEvent("popup");
    await page.keyboard.press("o");
    expect((await popup).url()).toBe("https://e2e.example.test/1");
  });

  test("? shows the help, where single-key shortcuts can be turned off", async ({ page }) => {
    await signIn(page, "/");
    await page.goto(`/?feed=${feed?.id}`);
    await expect(page.locator("html[data-shortcuts=on]")).toHaveCount(1);

    await page.keyboard.press("?");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Use single-key shortcuts").uncheck();
    await dialog.getByRole("button", { name: "Close" }).click();

    await page.keyboard.press("j");
    await expect(page.getByText("Select an entry to read it.")).toBeVisible();

    // The setting is remembered, and the help is still reachable by button.
    await page.reload();
    await expect(page.locator("html[data-shortcuts=on]")).toHaveCount(0);
    await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
    await expect(dialog.getByLabel("Use single-key shortcuts")).not.toBeChecked();
    await dialog.getByLabel("Use single-key shortcuts").check();
  });

  test("typing in a field does not trigger shortcuts", async ({ page }) => {
    await signIn(page, "/feeds");
    const field = page.getByLabel("Feed or website address");
    await field.click();
    await page.keyboard.type("jks?");
    await expect(field).toHaveValue("jks?");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
