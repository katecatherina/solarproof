# Secure Logging

## What is redacted

Any metadata key matching `/key|secret|token|password|sig|hex|private/i` has its value replaced with `[REDACTED]` before the log entry is written. Redaction is recursive — nested objects are traversed.

Examples of automatically redacted keys: `signature_hex`, `pubkey_hex`, `reading_hash` (contains `hex`), `secret_key`, `MINTER_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `private_key`, `token`, `password`.

## Usage

```ts
import { logger, redact } from '@/lib/logger'

// Structured log — sensitive fields in meta are auto-redacted
logger.info('Reading anchored', { meter_id, anchor_tx_hash, kwh })
logger.warn('Anchor slow', { meter_id, elapsed_ms: 3200 })
logger.error('Mint failed', { meter_id, error: message })

// Manually redact before passing to a third-party SDK
const safePayload = redact(rawPayload)
```

Output is newline-delimited JSON:

```json
{"level":"info","message":"Reading anchored","meter_id":"...","anchor_tx_hash":"[REDACTED]","kwh":12.5,"ts":"2026-06-26T16:00:00.000Z"}
```

## Patterns to avoid

| ❌ Avoid | ✅ Instead |
|---|---|
| `console.log('sig:', signature_hex)` | `logger.debug('sig received', { meter_id })` |
| `console.error(err, { secret: key })` | `logger.error('op failed', { meter_id, error: err.message })` |
| Logging full request bodies | Log only safe fields (meter_id, kwh, timestamp) |
| Logging Stellar Keypair objects | Log only public keys, never secrets |
| Logging Supabase client config | Never log env vars or client credentials |

## Code review checklist

- [ ] No `console.log/warn/error` calls outside `logger.ts` in `src/lib/` and `src/app/api/`
- [ ] No raw `signature_hex`, `pubkey_hex`, or `*_key` values in log arguments
- [ ] `redact()` applied to any object of unknown shape before logging
- [ ] Error logs include `meter_id` for traceability but not the full error stack in production
- [ ] No full request body logged at any level
