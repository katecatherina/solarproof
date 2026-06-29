import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { env } from '@/env'

const DEGRADED_THRESHOLD_MS = 300 // mark degraded if a check exceeds this
const TIMEOUT_MS = 450            // hard timeout per check (keeps total < 500 ms)

type CheckStatus = 'ok' | 'degraded' | 'error'

interface CheckResult {
  status: CheckStatus
  latency_ms: number
  error?: string
}

async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms)
  })
  try {
    const result = await Promise.race([promise, timeout])
    clearTimeout(timer!)
    return result
  } catch (err) {
    clearTimeout(timer!)
    throw err
  }
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const db = createServiceClient()
    await withTimeout(
      db.from('cooperatives').select('id', { count: 'exact', head: true }),
      TIMEOUT_MS
    )
    const latency_ms = Date.now() - start
    return { status: latency_ms > DEGRADED_THRESHOLD_MS ? 'degraded' : 'ok', latency_ms }
  } catch (err) {
    return { status: 'error', latency_ms: Date.now() - start, error: String(err) }
  }
}

async function checkStellarRpc(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const res = await withTimeout(
      fetch(env.NEXT_PUBLIC_STELLAR_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
      }),
      TIMEOUT_MS
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const latency_ms = Date.now() - start
    return { status: latency_ms > DEGRADED_THRESHOLD_MS ? 'degraded' : 'ok', latency_ms }
  } catch (err) {
    return { status: 'error', latency_ms: Date.now() - start, error: String(err) }
  }
}

/** GET /api/health — service health with DB + Stellar RPC checks */
export async function GET() {
  const checks = await Promise.all([
    checkDatabase(),
    checkStellarRpc(),
    checkRedisUpstash(),
    checkRedisBull(),
  ])

  const [db, stellar, upstash, bull] = checks

  const overallStatus: CheckStatus =
    [db, stellar, upstash, bull].some(c => c.status === 'error')
      ? 'error'
      : [db, stellar, upstash, bull].some(c => c.status === 'degraded')
      ? 'degraded'
      : 'ok'

  const httpStatus = overallStatus === 'error' ? 503 : 200

  return NextResponse.json(
    {
      status: overallStatus,
      ts: Date.now(),
      checks: { database: db, stellar_rpc: stellar, redis_upstash: upstash, redis_bull: bull },
    },
    { status: httpStatus }
  )
}

export { checkDatabase, checkStellarRpc }

async function checkRedisUpstash(): Promise<CheckResult> {
  const start = Date.now()
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url) return { status: 'degraded', latency_ms: 0 }
  try {
    const res = await withTimeout(
      fetch(`${url}/get/__health__`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      TIMEOUT_MS
    )
    const latency_ms = Date.now() - start
    return { status: res.ok ? (latency_ms > DEGRADED_THRESHOLD_MS ? 'degraded' : 'ok') : 'error', latency_ms }
  } catch (err) {
    return { status: 'error', latency_ms: Date.now() - start, error: String(err) }
  }
}

async function checkRedisBull(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const { getRedisConnection } = await import('@/lib/redis')
    const conn = getRedisConnection()
    const pong = await withTimeout(conn.ping(), TIMEOUT_MS)
    const latency_ms = Date.now() - start
    return { status: pong === 'PONG' ? (latency_ms > DEGRADED_THRESHOLD_MS ? 'degraded' : 'ok') : 'error', latency_ms }
  } catch (err) {
    return { status: 'error', latency_ms: Date.now() - start, error: String(err) }
  }
}
