import { expect, test } from "@playwright/test";

import { signIn } from "./fixtures";

test("the theme can be forced and is remembered across visits", async ({ page, isMobile }) => {
  test.skip(isMobile, "The sidebar is a disclosure on mobile; the control is the same.");
  await signIn(page, "/");
  const html = page.locator("html");
  const theme = page.getByRole("group", { name: "Theme" });

  await expect(theme.getByRole("radio", { name: "System" })).toBeChecked();
  await expect(html).not.toHaveAttribute("data-theme");

  await theme.getByText("Dark").click();
  await expect(html).toHaveAttribute("data-theme", "dark");

  // Rendered by the server from the cookie: no flash, no client script needed.
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(theme.getByRole("radio", { name: "Dark" })).toBeChecked();

  await theme.getByText("System").click();
  await expect(html).not.toHaveAttribute("data-theme");
  await page.reload();
  await expect(html).not.toHaveAttribute("data-theme");
});
