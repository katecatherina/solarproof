import { NextResponse } from 'next/server'
import {
  checkDatabase,
  checkStellarRpc,
  checkRedisUpstash,
  checkRedisBull,
  type CheckStatus,
} from '@/lib/health-checks'

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
