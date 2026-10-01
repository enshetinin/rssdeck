import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Newsreader } from "next/font/google";
import { cookies } from "next/headers";

import { parseThemePreference, THEME_COOKIE, themeAttribute } from "@/features/theme/theme";

import "./globals.css";

const atkinsonNext = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  variable: "--font-atkinson-next",
  display: "swap",
  // next/font has no metrics for this family yet; skip the synthetic fallback.
  adjustFontFallback: false,
});

// Editorial counterpoint, used only for article titles in the reader.
const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  variable: "--font-newsreader",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "RSSDeck",
    template: "%s · RSSDeck",
  },
  description: "A private RSS and Atom dashboard.",
  // A private dashboard: keep it out of search indexes.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2efe8" },
    { media: "(prefers-color-scheme: dark)", color: "#11100e" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      className={`${atkinsonNext.variable} ${newsreader.variable}`}
      data-theme={themeAttribute(theme)}
    >
      <body>
        <a className="yev-skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
