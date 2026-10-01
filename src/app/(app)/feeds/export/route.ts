import { NextResponse } from "next/server";

import { getCurrentUser } from "@/features/auth/session";
import { listFeeds } from "@/features/feeds/queries";
import { buildOpml } from "@/lib/opml/build-opml";

/** Downloads the signed-in user's subscriptions as OPML. */
export async function GET() {
  // The proxy already requires a session; checked again so the route is safe on its own.
  if (!(await getCurrentUser())) {
    return new NextResponse("Sign in to export your feeds.", { status: 401 });
  }

  const now = new Date();
  const opml = buildOpml(await listFeeds(), now);

  return new NextResponse(opml, {
    headers: {
      "Content-Type": "text/x-opml; charset=utf-8",
      "Content-Disposition": `attachment; filename="rssdeck-${now.toISOString().slice(0, 10)}.opml"`,
      "Cache-Control": "private, no-store",
    },
  });
}
