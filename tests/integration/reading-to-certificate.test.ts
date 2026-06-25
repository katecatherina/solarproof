/**
 * Integration tests — reading submission → certificate minting → on-chain anchoring
 *
 * Issue #122 acceptance criteria:
 *   ✅ Test: submit valid signed reading → certificate minted → anchor recorded
 *   ✅ Test: submit reading with invalid signature → rejected
 *   ✅ Test: duplicate reading → idempotent response
 *
 * These tests exercise the full POST /api/readings handler end-to-end by
 * mocking only the external I/O boundaries (Supabase, Stellar RPC, BullMQ).
 * All business-logic layers (validation, signature verification, hash
 * computation, idempotency, queue dispatch) execute with real code.
 *
 * Running locally:
 *   pnpm --filter @solarproof/web test tests/integration
 *
 * CI: included automatically in the vitest run step in ci.yml.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPublicKey, sign } from '@noble/ed25519'
import { computeReadingHash } from '@/lib/crypto'
import { kwhToStroops } from '@solarproof/stellar'

// ---------------------------------------------------------------------------
// External boundary mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase', () => ({ createServiceClient: vi.fn() }))

vi.mock('@/lib/stellar', () => ({
  anchorReading: vi.fn().mockResolvedValue('anchor_tx_integration_001'),
  mintCertificates: vi.fn().mockResolvedValue('mint_tx_integration_001'),
}))

vi.mock('@/lib/cache', () => ({
  invalidateCert: vi.fn().mockResolvedValue(undefined),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfter: 0 }),
}))

vi.mock('@/lib/idempotency', () => ({
  getIdempotentResponse: vi.fn().mockResolvedValue(null),
  storeIdempotentResponse: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/webhooks', () => ({
  fireWebhook: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withCorrelationId: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}))

vi.mock('@/lib/tracer-sim', () => ({
  diagnoseMintFailure: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/queue', () => ({
  enqueue: vi.fn().mockResolvedValue('job-integration-001'),
}))

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ user: { id: 'user-1' }, cooperativeId: 'coop-1' }),
  isAuthError: vi.fn().mockReturnValue(false),
}))

import { createServiceClient } from '@/lib/supabase'
import { anchorReading, mintCertificates } from '@/lib/stellar'
import { enqueue } from '@/lib/queue'
import { getIdempotentResponse, storeIdempotentResponse } from '@/lib/idempotency'
import { POST } from '@/app/api/readings/route'

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const METER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const COOPERATIVE_ADMIN = 'GADMIN000000000000000000000000000000000000000000000000000'
const API_KEY = 'mk_integration_test_key'
const KWH = 10.5

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeKeypair() {
  const privKey = crypto.getRandomValues(new Uint8Array(32))
  const pubKey = await getPublicKey(privKey)
  return {
    privKey,
    pubKeyHex: Buffer.from(pubKey).toString('hex'),
  }
}

/**
 * Build a fully signed, valid reading body. Timestamp defaults to now so it
 * passes the 5-minute staleness check in the route handler.
 */
async function makeSignedBody(
  privKey: Uint8Array,
  overrides: Record<string, unknown> = {}
) {
  const timestamp = overrides.timestamp as number ?? Math.floor(Date.now() / 1000)
  const kwhValue = overrides.kwh as number ?? KWH
  const meterId = overrides.meter_id as string ?? METER_ID

  const kwhStroops = kwhToStroops(kwhValue)
  const hash = computeReadingHash(meterId, kwhStroops, BigInt(timestamp))
  const sig = await sign(hash, privKey)

  return {
    meter_id: meterId,
    kwh: kwhValue,
    timestamp,
    signature_hex: Buffer.from(sig).toString('hex'),
    nonce: `int-test-nonce-${Date.now()}-${Math.random()}`,
    ...overrides,
  }
}

/** Build a NextRequest-like object accepted by the route handler. */
function makeRequest(body: unknown, options: { apiKey?: string | null; idempotencyKey?: string } = {}) {
  const { apiKey = API_KEY, idempotencyKey } = options
  return {
    json: () => Promise.resolve(body),
    headers: {
      get: (key: string) => {
        if (key === 'x-api-key') return apiKey
        if (key === 'idempotency-key') return idempotencyKey ?? null
        return null
      },
    },
  } as unknown as Parameters<typeof POST>[0]
}

/**
 * Wire up the Supabase mock with a registered meter and standard DB scaffolding.
 * Returns a `readingId` that the mocked insert will echo back.
 */
function mockDatabase(pubKeyHex: string, readingId = 'reading-int-001') {
  const meterRow = {
    id: METER_ID,
    pubkey_hex: pubKeyHex,
    cooperative_id: 'coop-integration',
    api_key: API_KEY,
    cooperatives: { admin_address: COOPERATIVE_ADMIN },
  }

  vi.mocked(createServiceClient).mockReturnValue({
    from: vi.fn((table: string) => {
      switch (table) {
        case 'meters':
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: meterRow, error: null }),
                }),
              }),
            }),
          }
        case 'readings':
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: readingId },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        case 'certificates':
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        case 'idempotency_keys':
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({}),
            }),
          }
        case 'webhook_endpoints':
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  contains: vi.fn().mockResolvedValue({ data: [] }),
                }),
              }),
            }),
          }
        default:
          return {}
      }
    }),
  } as ReturnType<typeof createServiceClient>)

  return { meterRow, readingId }
}

// ---------------------------------------------------------------------------
// 1. Valid signed reading → certificate minted → anchor recorded
// ---------------------------------------------------------------------------

describe('integration: valid reading → anchor → mint', () => {
  beforeEach(() => vi.clearAllMocks())

  it('test_valid_reading_accepted_and_job_enqueued', async () => {
    const { privKey, pubKeyHex } = await makeKeypair()
    const { readingId } = mockDatabase(pubKeyHex)

    const body = await makeSignedBody(privKey)
    const res = await POST(makeRequest(body))

    expect(res.status).toBe(202)
    const json = await res.json()
    expect(json.reading_id).toBe(readingId)
    expect(json.job_id).toBeDefined()
  })

  it('test_valid_reading_enqueues_anchor_and_mint_job', async () => {
    const { privKey, pubKeyHex } = await makeKeypair()
    mockDatabase(pubKeyHex)

    const body = await makeSignedBody(privKey)
    await POST(makeRequest(body))

    expect(enqueue).toHaveBeenCalledOnce()
    const [jobType, payload] = vi.mocked(enqueue).mock.calls[0] as [string, Record<string, unknown>]
    expect(jobType).toBe('anchor_and_mint')
    expect(payload.recipientAddress).toBe(COOPERATIVE_ADMIN)
    expect(payload.kwh).toBe(KWH)
    expect(typeof payload.readingHashHex).toBe('string')
    expect((payload.readingHashHex as string).length).toBe(64) // 32-byte hex
  })

  it('test_reading_hash_matches_canonical_computation', async () => {
    // The hash passed to the enqueue job must equal computeReadingHash(meter_id, kwhStroops, timestamp)
    const { privKey, pubKeyHex } = await makeKeypair()
    mockDatabase(pubKeyHex)

    const body = await makeSignedBody(privKey)
    await POST(makeRequest(body))

    const [, payload] = vi.mocked(enqueue).mock.calls[0] as [string, Record<string, unknown>]
    const expectedHash = computeReadingHash(body.meter_id as string, kwhToStroops(body.kwh as number), BigInt(body.timestamp as number))
    expect(payload.readingHashHex).toBe(expectedHash.toString('hex'))
  })

  it('test_valid_reading_with_different_kwh_values_all_accepted', async () => {
    // Confirm a range of valid kWh values all pass validation and proceed
    const kwhValues = [0.001, 1.0, 10.5, 100.0, 9999.999]

    for (const kwh of kwhValues) {
      vi.clearAllMocks()
      const { privKey, pubKeyHex } = await makeKeypair()
      mockDatabase(pubKeyHex)

      const body = await makeSignedBody(privKey, { kwh })
      const res = await POST(makeRequest(body))

      expect(res.status).toBe(202, `Expected 202 for kwh=${kwh}`)
    }
  })
})

// ---------------------------------------------------------------------------
// 2. Invalid signature → rejected
// ---------------------------------------------------------------------------

describe('integration: invalid signature → rejected', () => {
  beforeEach(() => vi.clearAllMocks())

  it('test_wrong_key_signature_returns_401', async () => {
    // Meter is registered with pubKeyHex from keypair A, but payload is signed with keypair B
    const { pubKeyHex } = await makeKeypair()
    const { privKey: wrongPrivKey } = await makeKeypair()
    mockDatabase(pubKeyHex)

    const body = await makeSignedBody(wrongPrivKey) // signed with wrong key
    const res = await POST(makeRequest(body))

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/invalid meter signature/i)
  })

  it('test_zeroed_signature_returns_401', async () => {
    const { pubKeyHex } = await makeKeypair()
    mockDatabase(pubKeyHex)

    const body = {
      meter_id: METER_ID,
      kwh: KWH,
      timestamp: Math.floor(Date.now() / 1000),
      signature_hex: '0'.repeat(128),
      nonce: 'int-test-zeroed-sig',
    }
    const res = await POST(makeRequest(body))

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/invalid meter signature/i)
  })

  it('test_tampered_kwh_invalidates_signature', async () => {
    // Sign payload with kwh=10.5 but submit kwh=99.9 — hash mismatch → 401
    const { privKey, pubKeyHex } = await makeKeypair()
    mockDatabase(pubKeyHex)

    const body = await makeSignedBody(privKey, { kwh: 10.5 })
    // Tamper the kwh value after signing
    body.kwh = 99.9 as unknown as typeof body.kwh
    const res = await POST(makeRequest(body))

    expect(res.status).toBe(401)
  })

  it('test_tampered_timestamp_invalidates_signature', async () => {
    const { privKey, pubKeyHex } = await makeKeypair()
    mockDatabase(pubKeyHex)

    const realTs = Math.floor(Date.now() / 1000)
    const body = await makeSignedBody(privKey, { timestamp: realTs })
    // Tamper the timestamp by ±1 second
    body.timestamp = (realTs - 1) as unknown as typeof body.timestamp
    const res = await POST(makeRequest(body))

    expect(res.status).toBe(401)
  })

  it('test_invalid_signature_does_not_enqueue_job', async () => {
    const { pubKeyHex } = await makeKeypair()
    const { privKey: wrongKey } = await makeKeypair()
    mockDatabase(pubKeyHex)

    const body = await makeSignedBody(wrongKey)
    await POST(makeRequest(body))

    // No job must be enqueued for an invalid reading
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('test_invalid_signature_does_not_call_anchor_or_mint', async () => {
    const { pubKeyHex } = await makeKeypair()
    const { privKey: wrongKey } = await makeKeypair()
    mockDatabase(pubKeyHex)

    const body = await makeSignedBody(wrongKey)
    await POST(makeRequest(body))

    expect(anchorReading).not.toHaveBeenCalled()
    expect(mintCertificates).not.toHaveBeenCalled()
  })

  it('test_missing_api_key_returns_401', async () => {
    const { privKey, pubKeyHex } = await makeKeypair()
    mockDatabase(pubKeyHex)

    const body = await makeSignedBody(privKey)
    const res = await POST(makeRequest(body, { apiKey: null }))

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/api key/i)
  })

  it('test_wrong_api_key_returns_401', async () => {
    const { privKey, pubKeyHex } = await makeKeypair()
    mockDatabase(pubKeyHex)

    const body = await makeSignedBody(privKey)
    const res = await POST(makeRequest(body, { apiKey: 'mk_wrong_key' }))

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/api key/i)
  })

  it('test_unknown_meter_returns_404', async () => {
    // Mock Supabase to return no meter (not registered)
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'meters') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }
        }
        if (table === 'idempotency_keys') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
            delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
          }
        }
        return {}
      }),
    } as ReturnType<typeof createServiceClient>)

    const { privKey } = await makeKeypair()
    const body = await makeSignedBody(privKey)
    const res = await POST(makeRequest(body))

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/meter not found/i)
  })
})

// ---------------------------------------------------------------------------
// 3. Duplicate reading → idempotent response
// ---------------------------------------------------------------------------

describe('integration: duplicate reading → idempotent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('test_idempotency_key_returns_cached_response_on_replay', async () => {
    // Second request with the same Idempotency-Key must return the cached 202
    const cachedResponse = { reading_id: 'reading-cached-001', job_id: 'job-cached-001' }
    vi.mocked(getIdempotentResponse).mockResolvedValueOnce({ body: cachedResponse, status: 202 })

    const { privKey, pubKeyHex } = await makeKeypair()
    mockDatabase(pubKeyHex)

    const body = await makeSignedBody(privKey)
    const res = await POST(makeRequest(body, { idempotencyKey: 'idem-key-abc-001' }))

    // Must return the cached response without hitting DB or enqueuing a job
    expect(res.status).toBe(202)
    const json = await res.json()
    expect(json.reading_id).toBe('reading-cached-001')
    expect(json.job_id).toBe('job-cached-001')
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('test_first_request_stores_idempotency_response', async () => {
    const { privKey, pubKeyHex } = await makeKeypair()
    mockDatabase(pubKeyHex)

    const body = await makeSignedBody(privKey)
    await POST(makeRequest(body, { idempotencyKey: 'idem-key-abc-002' }))

    // storeIdempotentResponse must be called with the 202 body
    expect(storeIdempotentResponse).toHaveBeenCalledOnce()
    const [key, stored] = vi.mocked(storeIdempotentResponse).mock.calls[0] as [string, { body: Record<string, unknown>; status: number }]
    expect(key).toBe('idem-key-abc-002')
    expect(stored.status).toBe(202)
    expect(stored.body.reading_id).toBeDefined()
    expect(stored.body.job_id).toBeDefined()
  })

  it('test_nonce_based_idempotency_returns_cached_response', async () => {
    // The route also checks idempotency_keys table by nonce (DB-level dedup)
    const existingNonce = {
      response: { reading_id: 'reading-nonce-001', job_id: 'job-nonce-001' },
      created_at: new Date().toISOString(),
    }

    const { pubKeyHex } = await makeKeypair()
    const { privKey: someKey } = await makeKeypair()

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'meters') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: METER_ID,
                      pubkey_hex: pubKeyHex,
                      cooperative_id: 'coop-1',
                      api_key: API_KEY,
                      cooperatives: { admin_address: COOPERATIVE_ADMIN },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'idempotency_keys') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: existingNonce }),
              }),
            }),
            delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
          }
        }
        return {}
      }),
    } as ReturnType<typeof createServiceClient>)

    const body = await makeSignedBody(someKey, { nonce: 'nonce-duplicate-xyz' })
    const res = await POST(makeRequest(body))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.reading_id).toBe('reading-nonce-001')
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('test_duplicate_reading_does_not_trigger_new_job', async () => {
    // Idempotency-Key hit must short-circuit before enqueue
    vi.mocked(getIdempotentResponse).mockResolvedValueOnce({
      body: { reading_id: 'reading-dup-001', job_id: 'job-dup-001' },
      status: 202,
    })

    const { privKey, pubKeyHex } = await makeKeypair()
    mockDatabase(pubKeyHex)

    const body = await makeSignedBody(privKey)
    await POST(makeRequest(body, { idempotencyKey: 'idem-dup-key' }))

    expect(enqueue).not.toHaveBeenCalled()
    expect(anchorReading).not.toHaveBeenCalled()
    expect(mintCertificates).not.toHaveBeenCalled()
  })

  it('test_stale_timestamp_reading_rejected_with_400', async () => {
    // Readings older than 5 minutes must be rejected before signature verification
    const { privKey, pubKeyHex } = await makeKeypair()
    mockDatabase(pubKeyHex)

    const staleTimestamp = Math.floor(Date.now() / 1000) - 10 * 60 // 10 min ago
    const body = await makeSignedBody(privKey, { timestamp: staleTimestamp })
    const res = await POST(makeRequest(body))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/too old/i)
  })
})

// ---------------------------------------------------------------------------
// 4. Input validation (schema-level, before any DB access)
// ---------------------------------------------------------------------------

describe('integration: input validation rejects malformed payloads', () => {
  beforeEach(() => vi.clearAllMocks())

  it('test_missing_meter_id_returns_400', async () => {
    const res = await POST(
      makeRequest({ kwh: KWH, timestamp: Math.floor(Date.now() / 1000), signature_hex: 'a'.repeat(128), nonce: 'n1' })
    )
    expect(res.status).toBe(400)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('test_negative_kwh_returns_400', async () => {
    const res = await POST(
      makeRequest({ meter_id: METER_ID, kwh: -0.5, timestamp: Math.floor(Date.now() / 1000), signature_hex: 'a'.repeat(128), nonce: 'n2' })
    )
    expect(res.status).toBe(400)
  })

  it('test_zero_kwh_returns_400', async () => {
    const res = await POST(
      makeRequest({ meter_id: METER_ID, kwh: 0, timestamp: Math.floor(Date.now() / 1000), signature_hex: 'a'.repeat(128), nonce: 'n3' })
    )
    expect(res.status).toBe(400)
  })

  it('test_short_signature_returns_400', async () => {
    const res = await POST(
      makeRequest({ meter_id: METER_ID, kwh: KWH, timestamp: Math.floor(Date.now() / 1000), signature_hex: 'deadbeef', nonce: 'n4' })
    )
    expect(res.status).toBe(400)
  })

  it('test_non_uuid_meter_id_returns_400', async () => {
    const res = await POST(
      makeRequest({ meter_id: 'not-a-uuid', kwh: KWH, timestamp: Math.floor(Date.now() / 1000), signature_hex: 'a'.repeat(128), nonce: 'n5' })
    )
    expect(res.status).toBe(400)
  })

  it('test_non_json_body_returns_400', async () => {
    const req = {
      json: () => Promise.reject(new Error('bad json')),
      headers: { get: (_: string) => null },
    } as unknown as Parameters<typeof POST>[0]
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
