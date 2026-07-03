import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * GET /api/audit-log/export?certificate_id=<id>[&from=ISO&to=ISO]
 *
 * Public (no-auth) CSV export of audit log entries for a specific certificate.
 * Intended for auditors and certificate buyers on the public verify page.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const certificateId = searchParams.get('certificate_id')
  if (!certificateId) {
    return NextResponse.json({ error: 'certificate_id is required' }, { status: 400 })
  }

  const from = searchParams.get('from') ?? new Date(Date.now() - 30 * 86_400_000).toISOString()
  const to = searchParams.get('to') ?? new Date().toISOString()

  const db = createServiceClient()
  const { data, error } = await db
    .from('audit_log')
    .select('id,operator_id,action,resource_id,ip_address,metadata,created_at')
    .eq('resource_id', certificateId)
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const header = 'id,operator_id,action,resource_id,ip_address,metadata,created_at\n'
  const rows = (data ?? []).map(r =>
    [r.id, r.operator_id, r.action, r.resource_id ?? '', r.ip_address ?? '',
     JSON.stringify(r.metadata ?? {}), r.created_at]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n')

  const filename = `audit_${certificateId}_${from.slice(0, 10)}_${to.slice(0, 10)}.csv`
  return new NextResponse(header + rows, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
