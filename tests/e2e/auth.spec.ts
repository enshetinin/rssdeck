import { expect, test } from "@playwright/test";

import packageJson from "../../package.json" with { type: "json" };
import { DEV_USER, signIn } from "./fixtures";

test("signed-out visitors are sent to sign in, then back", async ({ page }) => {
  await page.goto("/feeds");
  await expect(page).toHaveURL(/\/login\?next=%2Ffeeds$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();

  await page.getByLabel("Email").fill(DEV_USER.email);
  await page.getByLabel("Password").fill(DEV_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/feeds$/);
  const menu = page.getByRole("button", { name: "Menu" });
  if (await menu.isVisible()) await menu.click();
  await expect(page.getByRole("link", { name: "Manage feeds" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("a wrong password shows an error and keeps the email", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(DEV_USER.email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "Email or password is incorrect." }),
  ).toHaveText("Error: Email or password is incorrect.");
  await expect(page.getByLabel("Email")).toHaveValue(DEV_USER.email);
  await expect(page).toHaveURL(/\/login$/);
});

test("the post-login redirect cannot leave the site", async ({ page }) => {
  await page.goto("/login?next=https://evil.example.test/");
  await page.getByLabel("Email").fill(DEV_USER.email);
  await page.getByLabel("Password").fill(DEV_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
});

test("signing out ends the session", async ({ page }) => {
  await signIn(page);
  await page.goto("/feeds");
  const menu = page.getByRole("button", { name: "Menu" });
  if (await menu.isVisible()) await menu.click();
  await expect(page.getByText(DEV_USER.email)).toBeVisible();
  await expect(page.getByText(`RSSDeck ${packageJson.version}`)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/feeds");
  await expect(page).toHaveURL(/\/login\?next=%2Ffeeds$/);
});

test("skip link moves focus to the main content", async ({ page, isMobile }) => {
  test.skip(isMobile, "Keyboard navigation is a desktop concern.");
  await page.goto("/login");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});
