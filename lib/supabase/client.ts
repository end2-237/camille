// ─────────────────────────────────────────────────────────────────────────────
// lib/supabase/client.ts — Camille by Buyticle
// Supabase client factory — browser & server variants.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// ── Build-time placeholders ───────────────────────────────────────────────────
// The Supabase SDK validates that the URL is a non-empty string at instantiation
// time. During `next build` inside Docker, runtime env vars are not yet injected,
// so we fall back to placeholder values. The client is never actually invoked
// during the build — only at runtime when real env vars are present.

const BUILD_URL = "https://placeholder-build.supabase.co";
const BUILD_KEY = "placeholder-build-key";

/** Browser/client-side Supabase instance (uses anon key) */
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL    || BUILD_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || BUILD_KEY,
  {
    auth: {
      persistSession:   true,
      autoRefreshToken: true,
    },
  }
);

/** Server-side Supabase instance with service role key (never expose to client) */
export function createServerClient() {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL    || BUILD_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY   || BUILD_KEY;

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });
}
