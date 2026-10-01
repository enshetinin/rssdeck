/**
 * Only same-origin paths may be used as a post-login destination. Anything
 * else (absolute URLs, protocol-relative "//host", backslash tricks) falls
 * back to the home page, so the login form cannot become an open redirect.
 */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (/[\u0000-\u001f]/.test(value)) return "/";
  return value;
}
