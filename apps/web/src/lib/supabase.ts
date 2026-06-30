/**
 * Centralized Supabase client initialization.
 *
 * Two clients are exported from this single module:
 *
 * - `supabase`            — browser/anon client, safe to use in client
 *                           components. Uses the public anon key and
 *                           respects Row-Level Security policies.
 *
 * - `createServiceClient` — server-only factory that creates a service-role
 *                           client. Bypasses RLS. Call this only from API
 *                           routes or Server Components — never import it
 *                           in client-side code.
 *
 * Both clients are typed with the generated `Database` interface so all
 * table/column access is fully type-checked at compile time.
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL        — Supabase project URL (public)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   — Supabase anon/public key
 *   SUPABASE_SERVICE_ROLE_KEY       — Supabase service-role secret (server only)
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// ---------------------------------------------------------------------------
// Validate required environment variables at module load time so misconfigured
// deployments fail fast with a clear message rather than a cryptic runtime
// error deep inside a fetch call.
// ---------------------------------------------------------------------------
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `[supabase] Missing required environment variable: ${key}. ` +
        'Check your .env.local file or deployment environment.'
    )
  }
  return value
}

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

// ---------------------------------------------------------------------------
// Browser / anon client (singleton)
// Reuse the same instance across the app to avoid creating multiple
// GoTrue auth instances, which can cause session-sync issues.
// ---------------------------------------------------------------------------
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey
)

// ---------------------------------------------------------------------------
// Server-only service-role client factory
// Returns a new client instance each time so it is safe to call in
// concurrent server requests without shared mutable state.
// Do NOT cache or export this instance — callers get a fresh client each time
// to prevent accidental cross-request data leaks.
// ---------------------------------------------------------------------------
export function createServiceClient(): SupabaseClient<Database> {
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      // Never persist a session for the service-role client; it is used
      // purely for server-side operations with full database access.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
