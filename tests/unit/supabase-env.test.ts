import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupabasePublicEnv } from "@/lib/supabase/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSupabasePublicEnv", () => {
  it("names exactly the variable that is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.example.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(() => getSupabasePublicEnv()).toThrow(/^Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\./);
  });
});
