import { expect, test } from "@playwright/test";

test("renders the application shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/RSSDeck/);
  await expect(page.getByRole("banner")).toContainText("RSSDeck");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("skip link moves focus to the main content", async ({ page, isMobile }) => {
  test.skip(isMobile, "Keyboard navigation is a desktop concern.");
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});
