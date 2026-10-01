"use client";

import { useState } from "react";

import { THEME_COOKIE, themeAttribute, type ThemePreference } from "./theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function applyTheme(preference: ThemePreference) {
  const attribute = themeAttribute(preference);
  if (attribute) document.documentElement.dataset.theme = attribute;
  else delete document.documentElement.dataset.theme;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    preference === "system"
      ? `${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
      : `${THEME_COOKIE}=${preference}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

/** Theme switch built on the yev-design choice group (native radios). */
export function ThemeChoice({ initial }: { initial: ThemePreference }) {
  const [preference, setPreference] = useState(initial);

  return (
    <fieldset className="yev-choices theme-choice">
      <legend>Theme</legend>
      {OPTIONS.map((option) => (
        <label key={option.value} className="yev-choice">
          <input
            type="radio"
            name="theme"
            value={option.value}
            checked={preference === option.value}
            onChange={() => {
              setPreference(option.value);
              applyTheme(option.value);
            }}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
