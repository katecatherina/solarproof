import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase'

const MeterSchema = z.object({
  cooperative_id: z.string().uuid(),
  serial_number: z.string().min(1),
  pubkey_hex: z.string().regex(/^[0-9a-f]{64}$/i, 'pubkey_hex must be exactly 64 hex characters (Ed25519 32-byte public key)'),
})

/**
 * POST /api/meters
 *
 * Register a new HSM-backed meter device.
 * Body: { cooperative_id, serial_number, pubkey_hex }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = MeterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { cooperative_id, serial_number, pubkey_hex } = parsed.data
  const db = createServiceClient()

  const { data: meter, error } = await db
    .from('meters')
    .insert({ cooperative_id, serial_number, pubkey_hex, active: true })
    .select('id')
    .single()

  if (error) {
    // Unique constraint violation (serial_number or pubkey already registered)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Meter already registered' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to register meter' }, { status: 500 })
  }

  return NextResponse.json({ meter_id: meter.id }, { status: 201 })
}
