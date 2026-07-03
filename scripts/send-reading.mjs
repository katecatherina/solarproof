#!/usr/bin/env node
/**
 * scripts/send-reading.mjs
 *
 * Simulate a smart meter sending a signed reading (+ optional metadata) to the SolarProof API.
 *
 * Usage:
 *   node scripts/send-reading.mjs \
 *     --meter-id <uuid> \
 *     --kwh 12.5 \
 *     --key ./meter-key.json \
 *     --api http://localhost:3000 \
 *     [--firmware 1.2.3] \
 *     [--model "SolarEdge-SE7600H"] \
 *     [--manufacturer "SolarEdge"]
 */

import { createSign, createHash } from 'crypto'
import { readFileSync } from 'fs'

const args = process.argv.slice(2)
const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null }

const meterId = get('--meter-id') ?? 'test-meter-id'
const kwh = parseFloat(get('--kwh') ?? '10')
const keyFile = get('--key') ?? './meter-key.json'
const api = get('--api') ?? 'http://localhost:3000'
const firmware = get('--firmware')
const model = get('--model')
const manufacturer = get('--manufacturer')

const { private_key_hex } = JSON.parse(readFileSync(keyFile, 'utf8'))
const timestamp = Math.floor(Date.now() / 1000)
const kwhStroops = BigInt(Math.round(kwh * 1e7))

// Canonical hash: SHA-256(meter_id_utf8 || kwh_stroops_le64 || timestamp_le64)
const meterBytes = Buffer.from(meterId, 'utf8')
const kwhBuf = Buffer.alloc(8); kwhBuf.writeBigInt64LE(kwhStroops)
const tsBuf = Buffer.alloc(8); tsBuf.writeBigInt64LE(BigInt(timestamp))
const readingHash = createHash('sha256').update(meterBytes).update(kwhBuf).update(tsBuf).digest()

// Sign with Ed25519
const privKeyDer = Buffer.concat([
  Buffer.from('302e020100300506032b657004220420', 'hex'),
  Buffer.from(private_key_hex, 'hex'),
])

function signHash(hash) {
  const sign = createSign('ed25519')
  sign.update(hash)
  return sign.sign({ key: privKeyDer, format: 'der', type: 'pkcs8' })
}

const signature = signHash(readingHash)

const body = {
  meter_id: meterId,
  kwh,
  timestamp,
  signature_hex: signature.toString('hex'),
  nonce: `sim-${meterId}-${timestamp}-${Math.floor(Math.random() * 1000000)}`,
}

// Attach optional signed metadata
const metadata = {}
if (firmware) metadata.firmware_version = firmware
if (model) metadata.hardware_model = model
if (manufacturer) metadata.manufacturer = manufacturer

if (Object.keys(metadata).length > 0) {
  const canonical = JSON.stringify(metadata, Object.keys(metadata).sort())
  const metadataHash = createHash('sha256').update(Buffer.from(canonical, 'utf8')).digest()
  const metadataSig = signHash(metadataHash)
  body.metadata = metadata
  body.metadata_signature_hex = metadataSig.toString('hex')
  console.log('Metadata hash:', metadataHash.toString('hex'))
}

console.log('Sending reading:', { meterId, kwh, timestamp })
console.log('Reading hash:', readingHash.toString('hex'))

const res = await fetch(`${api}/api/readings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const data = await res.json()
console.log(res.ok ? '✓ Success:' : '✗ Error:', data)
