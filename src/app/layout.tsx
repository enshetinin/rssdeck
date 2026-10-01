import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";

import "./globals.css";

const atkinsonNext = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  variable: "--font-atkinson-next",
  display: "swap",
  // next/font has no metrics for this family yet; skip the synthetic fallback.
  adjustFontFallback: false,
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={atkinsonNext.variable}>
      <body>
        <a className="yev-skip-link" href="#main">
          Skip to content
        </a>
        <header className="shell-header">
          <div className="yev-frame">
            <span className="shell-wordmark">RSSDeck</span>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="shell-main">
          {children}
        </main>
      </body>
    </html>
  );
}
