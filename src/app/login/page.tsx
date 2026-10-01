import type { Metadata } from "next";

import { safeRedirectPath } from "@/features/auth/redirect";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;

  return (
    <>
      <header className="shell-header">
        <div className="yev-frame">
          <span className="shell-wordmark">RSSDeck</span>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="shell-main">
        <div className="yev-frame shell-layout">
          <div className="shell-context">
            <h1>Sign in</h1>
          </div>
          <LoginForm next={safeRedirectPath(next)} />
        </div>
      </main>
    </>
  );
}
