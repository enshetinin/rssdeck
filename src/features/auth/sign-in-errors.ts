export type SignInFailure = { code?: string | undefined; status?: number | undefined };

/**
 * What to tell the user when Supabase rejects a sign-in. Wrong email and
 * wrong password share one message so the form does not reveal which accounts
 * exist; everything that is not about the credentials (configuration,
 * outages) must not be disguised as a wrong password.
 */
export function signInErrorMessage(failure: SignInFailure): string {
  switch (failure.code) {
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "email_not_confirmed":
      return "This account is not confirmed yet. Confirm the user in Supabase, then try again.";
    case "user_banned":
      return "This account is disabled.";
    case "over_request_rate_limit":
      return "Too many sign-in attempts. Wait a moment and try again.";
  }
  if (failure.status === 429) return "Too many sign-in attempts. Wait a moment and try again.";
  if (failure.status === 400 && !failure.code) return "Email or password is incorrect.";
  return "Sign-in is not available right now. Try again later.";
}
