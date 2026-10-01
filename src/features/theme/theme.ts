// Light/dark preference. "system" follows the OS (yev-design tokens use
// light-dark()); "light" and "dark" force a theme with data-theme on <html>.
// Kept in a cookie so the server renders the right theme without a flash.

export const THEME_COOKIE = "rssdeck-theme";

export type ThemePreference = "system" | "light" | "dark";

export function parseThemePreference(value: string | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

/** The data-theme value for <html>; none means "follow the system". */
export function themeAttribute(preference: ThemePreference): "light" | "dark" | undefined {
  return preference === "system" ? undefined : preference;
}
