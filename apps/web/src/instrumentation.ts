/**
 * instrumentation.ts
 *
 * Next.js instrumentation hook — runs once per server process startup.
 * Used here to confirm the metrics pipeline is active.
 */
export async function register() {
  // Server-side: nothing to register beyond what Sentry already wires up
  // via withSentryConfig in next.config.ts
}

/**
 * onRequestError — forwarded to Sentry automatically via withSentryConfig.
 * Exported here so Next.js 15 routes it correctly.
 */
export { onRequestError } from '@sentry/nextjs'
