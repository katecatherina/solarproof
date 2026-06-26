import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase'

const RotateKeySchema = z.object({
  pubkey_hex: z.string().regex(/^[0-9a-f]{64}$/i, 'pubkey_hex must be exactly 64 hex characters (Ed25519 32-byte public key)'),
})

/**
 * POST /api/meters/:id/rotate-key
 *
 * Rotate the Ed25519 public key for a meter (HSM key rotation).
 * Body: { pubkey_hex }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const body = await req.json().catch(() => null)
  const parsed = RotateKeySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('meters')
    .update({ pubkey_hex: parsed.data.pubkey_hex })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to rotate key' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
