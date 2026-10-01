import type { NextRequest } from "next/server";

import { redirectWithSession, updateSession } from "@/lib/supabase/proxy";

const LOGIN_PATH = "/login";

export async function proxy(request: NextRequest) {
  const { response, isSignedIn } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!isSignedIn && pathname !== LOGIN_PATH) {
    const login = new URL(LOGIN_PATH, request.url);
    // Return here after signing in. Validated again by the sign-in action.
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return redirectWithSession(response, login);
  }

  if (isSignedIn && pathname === LOGIN_PATH) {
    return redirectWithSession(response, new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimization.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
