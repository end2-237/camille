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

// ── Env var resolution ────────────────────────────────────────────────────────
//
// NEXT_PUBLIC_* vars are baked at BUILD time in Next.js — they work when set
// as build-time variables in Coolify.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are plain runtime vars — set them
// in Coolify's Environment Variables panel (no NEXT_PUBLIC_ prefix needed).
// They are only read server-side so they are never exposed to the browser.
//
// Priority for server client URL:
//   1. SUPABASE_URL          ← preferred (runtime, set in Coolify)
//   2. NEXT_PUBLIC_SUPABASE_URL ← fallback (build-time)
//   3. BUILD_URL             ← build placeholder (never used in production)

/** Browser/client-side Supabase instance (uses anon key) */
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL      || BUILD_URL,
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
  const url = process.env.SUPABASE_URL
           || process.env.NEXT_PUBLIC_SUPABASE_URL
           || BUILD_URL;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || BUILD_KEY;

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });
}
