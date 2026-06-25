import { useMutation } from '@tanstack/react-query'

export interface ChainOfCustody {
  certificate: {
    id: string
    kwh: number
    issued_at: string
    retired: boolean
    retired_at: string | null
    retired_by: string | null
  }
  on_chain: {
    anchor_tx: string
    anchor_explorer: string
    mint_tx: string
    mint_explorer: string
  }
  meter_proof:
    | {
        meter_id: string
        reading_hash: string
        signature_hex: string
        kwh: number
        timestamp: string
        verified: boolean
      }
    | null
}

export async function verifyCertificate(id: string): Promise<ChainOfCustody> {
  const response = await fetch(`/api/verify?id=${encodeURIComponent(id)}`)
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error((body as { error?: string })?.error ?? 'Verification failed')
  }

  return body as ChainOfCustody
}

export function useVerifyCertificate() {
  return useMutation<ChainOfCustody, Error, string>({
    mutationFn: verifyCertificate,
    retry: false,
  })
}
