import { Suspense } from "react";

import { requireUser } from "@/features/auth/session";
import { AppSidebar } from "@/features/entries/app-sidebar";
import { getSidebarData } from "@/features/entries/queries";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const sidebar = await getSidebarData();

  return (
    <div className="app-shell">
      {/* useSearchParams needs a Suspense boundary. */}
      <Suspense>
        <AppSidebar data={sidebar} email={user.email} />
      </Suspense>
      <main id="main" tabIndex={-1} className="app-main">
        {children}
      </main>
    </div>
  );
}
