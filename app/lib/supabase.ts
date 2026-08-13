import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

// Returns null (not throws) when Supabase isn't configured yet, so callers
// can gracefully fall back to email-only booking until the env vars exist.
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    client = null;
    return client;
  }

  // Service-role key bypasses RLS -- server-side use only, never expose to the client.
  client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return client;
}
