/**
 * In-memory IP-based rate limiter for public API endpoints.
 *
 * Abuse protection rules (documented):
 *   POST /api/readings — 10 requests / 60 s per IP
 *   GET  /api/verify   — 30 requests / 60 s per IP
 *
 * In production, replace the in-memory store with an edge KV store
 * (e.g. Upstash Redis / Vercel KV) so limits are enforced across all
 * serverless instances.
 */

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check whether the given key (typically `<ip>:<route>`) is within
 * the allowed request window.
 *
 * @param key     Identifier for this client + route combination
 * @param limit   Maximum requests allowed per window
 * @param windowMs Duration of the rate-limit window in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  let bucket = store.get(key)

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
    store.set(key, bucket)
  }

  bucket.count += 1
  const remaining = Math.max(0, limit - bucket.count)
  const allowed = bucket.count <= limit
  return { allowed, remaining, resetAt: bucket.resetAt }
}

/**
 * Extract the real client IP from a Next.js request, respecting common
 * reverse-proxy headers (Vercel / Cloudflare / standard X-Forwarded-For).
 */
export function getClientIp(req: Request): string {
  const headers = req instanceof Request ? req.headers : (req as { headers: Headers }).headers
  return (
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  )
}
