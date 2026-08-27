"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

// Browser-safe Supabase client for pages that need user login (e.g. the
// leads admin page). Uses the ANON key, not the service-role key — auth
// and data access are gated by Supabase Row Level Security policies (see
// supabase/add_lead_fields.sql), never by trusting the browser.
//
// Required env vars (safe to expose to the browser — this is the
// "publishable" key, not the service-role secret):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
export function getSupabaseBrowser(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    client = null;
    return client;
  }

  client = createClient(url, anonKey);
  return client;
}
