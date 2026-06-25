import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * GET /api/certificates
 *
 * Query params:
 *   from      – ISO date (start of range)
 *   to        – ISO date (end of range)
 *   meter_id  – filter by meter UUID
 *   format    – "csv" to download as CSV
 *   page      – 1-based page number (default 1)
 *   limit     – rows per page (default 20, max 100)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const meter_id = searchParams.get('meter_id')
  const format = searchParams.get('format')
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
  const offset = (page - 1) * limit

  const db = createServiceClient()

  let query = db
    .from('certificates')
    .select('id, kwh, issued_at, retired, retired_at, anchor_tx_hash, mint_tx_hash, reading_id, cooperative_id', { count: 'exact' })
    .order('issued_at', { ascending: false })

  if (from) query = query.gte('issued_at', from)
  if (to) query = query.lte('issued_at', to)
  if (meter_id) {
    // join via reading_id → readings.meter_id
    const { data: readingIds } = await db
      .from('readings')
      .select('id')
      .eq('meter_id', meter_id)
    const ids = (readingIds ?? []).map((r) => r.id)
    if (ids.length === 0) return NextResponse.json({ certificates: [], total: 0, page, limit })
    query = query.in('reading_id', ids)
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const certificates = data ?? []

  if (format === 'csv') {
    const header = 'id,kwh,issued_at,retired,retired_at,anchor_tx_hash,mint_tx_hash'
    const rows = certificates.map((c) =>
      [c.id, c.kwh, c.issued_at, c.retired, c.retired_at ?? '', c.anchor_tx_hash, c.mint_tx_hash].join(',')
    )
    const csv = [header, ...rows].join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="certificates.csv"',
      },
    })
  }

  return NextResponse.json({ certificates, total: count ?? 0, page, limit })
}
