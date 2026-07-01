/**
 * Validates that all required service secrets are present at startup.
 * Import this module early (e.g. in next.config.ts) so missing env vars
 * cause a hard crash with a clear message rather than a runtime error
 * deep inside a request handler.
 *
 * Resolves #545
 */

const REQUIRED_SERVER_SECRETS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'MINTER_SECRET_KEY',
] as const

const REQUIRED_PUBLIC_VARS = [
  'NEXT_PUBLIC_STELLAR_NETWORK',
  'NEXT_PUBLIC_ENERGY_TOKEN_ID',
  'NEXT_PUBLIC_AUDIT_REGISTRY_ID',
] as const

export function validateEnv(): void {
  const missing: string[] = []

  for (const key of [...REQUIRED_SERVER_SECRETS, ...REQUIRED_PUBLIC_VARS]) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  ${missing.join('\n  ')}\n\nCopy .env.example to .env.local and fill in the values.`,
    )
  }
}
