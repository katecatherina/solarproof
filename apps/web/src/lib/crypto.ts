import { createHash } from 'crypto'

/**
 * Compute the canonical reading hash: SHA-256(meter_id || kwh_stroops_le || timestamp_le)
 * This must match the hash signed by the meter device.
 */
export function computeReadingHash(meterId: string, kwhStroops: bigint, timestampUnix: bigint): Buffer {
  const meterBytes = Buffer.from(meterId, 'utf8')
  const kwhBuf = Buffer.alloc(8)
  kwhBuf.writeBigInt64LE(kwhStroops)
  const tsBuf = Buffer.alloc(8)
  tsBuf.writeBigInt64LE(timestampUnix)
  return createHash('sha256').update(meterBytes).update(kwhBuf).update(tsBuf).digest()
}

/**
 * Meter metadata that can accompany a signed reading.
 * All fields are optional — the meter may not expose all of them.
 */
export interface MeterMetadata {
  firmware_version?: string
  hardware_model?: string
  location_lat?: number
  location_lon?: number
  manufacturer?: string
}

/**
 * Compute the canonical metadata hash: SHA-256(canonical JSON of metadata).
 * The meter signs this hash with its Ed25519 key so the payload is tamper-evident.
 */
export function computeMetadataHash(metadata: MeterMetadata): Buffer {
  // Sort keys for deterministic serialisation
  const canonical = JSON.stringify(metadata, Object.keys(metadata).sort())
  return createHash('sha256').update(Buffer.from(canonical, 'utf8')).digest()
}
