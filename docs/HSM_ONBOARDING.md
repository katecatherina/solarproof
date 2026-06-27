# HSM-Backed Meter Onboarding

This guide explains how to register a hardware-secured meter device with SolarProof and how to rotate its key when required.

---

## What is an HSM in this context?

A Hardware Security Module (HSM) is a tamper-resistant device that generates and stores cryptographic keys without ever exposing the private key material. For SolarProof meters, this means:

- Each meter device has a **YubiKey** or **TPM** (Trusted Platform Module) that generates an **Ed25519 keypair** on-device.
- The private key never leaves the hardware.
- Every meter reading is signed by the HSM before being sent to the API, providing a cryptographic proof that the reading originated from that specific physical device.

---

## Registering a Meter (POST /api/meters)

Before a meter can submit readings, it must be registered with its cooperative and its Ed25519 public key.

### Request

```
POST /api/meters
Content-Type: application/json
```

```json
{
  "cooperative_id": "<uuid>",
  "serial_number": "METER-001",
  "pubkey_hex": "<64 lowercase hex characters>"
}
```

| Field | Type | Description |
|---|---|---|
| `cooperative_id` | UUID | The cooperative this meter belongs to |
| `serial_number` | string | Unique human-readable device identifier |
| `pubkey_hex` | string | Ed25519 public key — exactly 64 hex chars (32 bytes) |

### Responses

| Status | Meaning |
|---|---|
| `201` | Meter registered — body contains `{ "meter_id": "<uuid>" }` |
| `400` | Validation error (missing fields, invalid pubkey format) |
| `409` | Meter already registered (duplicate serial_number or pubkey) |

### Example

```bash
curl -X POST https://solarproof.vercel.app/api/meters \
  -H "Content-Type: application/json" \
  -d '{
    "cooperative_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "serial_number": "METER-001",
    "pubkey_hex": "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"
  }'
```

```json
{ "meter_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479" }
```

---

## Rotating a Meter Key (POST /api/meters/:id/rotate-key)

HSMs support key rotation — generating a new keypair on the device while retiring the old one. After rotation, the new public key must be registered so the API can verify future readings.

### Request

```
POST /api/meters/:id/rotate-key
Content-Type: application/json
```

```json
{
  "pubkey_hex": "<new 64 hex characters>"
}
```

### Responses

| Status | Meaning |
|---|---|
| `200` | Key updated — body contains `{ "success": true }` |
| `400` | Validation error |
| `500` | Database error |

### Example

```bash
curl -X POST https://solarproof.vercel.app/api/meters/f47ac10b-58cc-4372-a567-0e02b2c3d479/rotate-key \
  -H "Content-Type: application/json" \
  -d '{
    "pubkey_hex": "1122334455667788990011223344556677889900112233445566778899001122"
  }'
```

```json
{ "success": true }
```

---

## Extracting the Public Key from a YubiKey

```bash
# List YubiKey PIV slots
ykman piv info

# Generate Ed25519 key in slot 9a and export the public key
ykman piv keys generate --algorithm ED25519 9a pubkey.pem

# Convert PEM to raw hex (32 bytes)
openssl pkey -in pubkey.pem -pubin -outform DER | tail -c 32 | xxd -p -c 32
```

---

## Security Notes

- **Key custody**: The private key is generated and stored exclusively inside the HSM. The API only receives and stores the public key.
- **Key rotation**: Rotate keys if a device is decommissioned, the HSM firmware is updated, or as part of your cooperative's security policy. Readings signed with the old key remain valid against the archived public key in audit records.
- **Transport security**: Always use HTTPS when calling these endpoints to protect the public key in transit.
- **Authorization**: These endpoints use the Supabase service role client. In production, protect them behind your cooperative's authentication layer (e.g., a signed JWT from the admin dashboard).
