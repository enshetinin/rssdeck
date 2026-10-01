import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

import { getSupabasePublicEnv } from "./env";

/**
 * Refreshes the Supabase session on every matched request and forwards the
 * updated cookies to both the downstream request and the browser.
 */
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Keeps CDNs from caching a response that carries a session cookie.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Validates the JWT and refreshes an expiring session. Do not put code
  // between client creation and this call.
  const { data, error } = await supabase.auth.getClaims();

  // A session cookie that does not validate means a broken setup (wrong
  // Supabase URL or key, unreachable JWKS), not a signed-out visitor.
  if (error && request.cookies.getAll().some(({ name }) => name.startsWith("sb-"))) {
    console.error("Session validation failed:", { name: error.name, message: error.message });
  }

  return { response, isSignedIn: Boolean(data?.claims) };
}

/** A redirect that keeps any session cookies the refresh just wrote. */
export function redirectWithSession(from: NextResponse, target: URL) {
  const redirect = NextResponse.redirect(target);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  const cacheControl = from.headers.get("cache-control");
  if (cacheControl) redirect.headers.set("cache-control", cacheControl);
  return redirect;
}
