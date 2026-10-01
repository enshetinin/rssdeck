import { describe, expect, it } from "vitest";

import { signInErrorMessage } from "@/features/auth/sign-in-errors";

describe("signInErrorMessage", () => {
  it("uses one message for wrong email and wrong password", () => {
    expect(signInErrorMessage({ code: "invalid_credentials", status: 400 })).toBe(
      "Email or password is incorrect.",
    );
  });

  it.each([
    [{ code: "email_not_confirmed", status: 400 }, /not confirmed/],
    [{ code: "user_banned", status: 400 }, /disabled/],
    [{ code: "over_request_rate_limit", status: 429 }, /Too many/],
    [{ status: 429 }, /Too many/],
  ])("explains %j", (failure, message) => {
    expect(signInErrorMessage(failure)).toMatch(message);
  });

  it.each([
    { status: 401 }, // e.g. an invalid API key
    { status: 500 },
    { code: "unexpected_failure", status: 500 },
    {}, // network error before any response
  ])("does not blame the password for %j", (failure) => {
    expect(signInErrorMessage(failure)).toBe(
      "Sign-in is not available right now. Try again later.",
    );
  });
});
