import { NextResponse } from 'next/server'
import { checkDatabase, checkStellarRpc } from '@/app/api/health/route'

export async function GET() {
  const [db, stellar] = await Promise.all([checkDatabase(), checkStellarRpc()])

  // For readiness we require all critical dependencies to be fully OK
  const healthy = db.status === 'ok' && stellar.status === 'ok'

  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', checks: { database: db, stellar_rpc: stellar } },
    { status: healthy ? 200 : 503 }
  )
}
