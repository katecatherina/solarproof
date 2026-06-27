# Abuse Protection

SolarProof's public API endpoints are protected against abuse via IP-based rate limiting, strict request validation, and response headers.

---

## Endpoints covered

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/readings` | 10 requests | 60 seconds per IP |
| `GET /api/verify` | 30 requests | 60 seconds per IP |

---

## Rate limiting

Rate limiting is implemented in `apps/web/src/lib/rate-limit.ts`.

When the limit is exceeded the API returns:

```
HTTP 429 Too Many Requests
Retry-After: <seconds until reset>
X-RateLimit-Limit: <limit>
X-RateLimit-Remaining: 0
```

**Current backend:** in-memory store (per serverless instance).  
**Recommended for production:** replace with an edge-distributed store (e.g. [Upstash Redis](https://upstash.com/) or Vercel KV) so limits are enforced consistently across all instances.

---

## Request validation

All `POST /api/readings` requests are validated with [Zod](https://zod.dev/) before any DB or chain operation:

| Field | Rule |
|---|---|
| `meter_id` | Valid UUID |
| `kwh` | Positive number |
| `timestamp` | Positive integer (Unix seconds) |
| `signature_hex` | 128-character hex string (64-byte Ed25519) |

Invalid payloads receive `HTTP 400` with a structured error body.

---

## Ed25519 signature verification

The server rejects any reading whose Ed25519 signature does not verify against the registered meter public key.  
This prevents fabricated readings from untrusted sources (`HTTP 401`).

---

## CAPTCHA / bot detection (future)

For higher-risk scenarios (e.g. a future public submission UI) add CAPTCHA at the network/CDN layer:

- **Cloudflare Turnstile** — zero-friction, works with edge middleware
- **hCaptcha** — open alternative
- Place the challenge in the frontend form; pass the token to the API and verify it server-side before processing.

---

## Legitimate clients

Legitimate meter devices operate well within the rate limits (typically one reading every few minutes per device).  
The Zod schema is designed to accept all valid meter payloads without false rejections.

---

## Escalation

If automated abuse is detected (patterns consistent with replay attacks or scanning), report via [GitHub Security Advisories](../../../security/advisories/new) or rotate the affected meter keypair.
