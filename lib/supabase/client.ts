// ─────────────────────────────────────────────────────────────────────────────
// lib/supabase/client.ts — Camille by Buyticle
// Supabase client factory — browser & server variants.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Env vars are read lazily (inside functions) so the module can be imported
// during the Next.js build without throwing when vars are not yet set.

/** Browser/client-side Supabase instance (uses anon key) */
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

/** Server-side Supabase instance with service role key (never expose to client) */
export function createServerClient() {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "[Camille] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for server operations."
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });
}
