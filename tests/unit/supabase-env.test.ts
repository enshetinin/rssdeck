import { afterEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createAdminClient", () => {
  it("works with only the URL and the service-role key, as the cron job is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.example.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fake-service-role-key-for-tests");

    expect(() => createAdminClient()).not.toThrow();
  });

  it("names the missing service-role key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.example.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});

describe("getSupabasePublicEnv", () => {
  it("names exactly the variable that is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.example.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(() => getSupabasePublicEnv()).toThrow(/^Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\./);
  });
});
