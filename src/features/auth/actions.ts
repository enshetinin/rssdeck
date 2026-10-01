"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { safeRedirectPath } from "./redirect";

export type SignInState = {
  error: string | null;
  email: string;
};

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email address and password.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // One message for unknown email and wrong password: do not reveal which.
    const message =
      error.status === 429
        ? "Too many sign-in attempts. Wait a moment and try again."
        : "Email or password is incorrect.";
    return { error: message, email };
  }

  redirect(safeRedirectPath(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  // Only this device: other signed-in sessions stay valid.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  // The local session cookies are cleared even when revoking the refresh
  // token on the server fails, so the user is signed out either way.
  if (error) console.error("Sign-out could not revoke the session:", error.message);
  redirect("/login");
}
