# Data Classification and Retention Policy

> Applies to all data stored in SolarProof's Supabase instance.

---

## 1. Classification Categories

| Level | Definition |
|---|---|
| **Public** | No sensitivity; safe for anyone to read. On-chain transaction hashes, kWh totals on certificates. |
| **Internal** | Operational data; visible to cooperative members. Meter serial numbers, cooperative names, reading timestamps. |
| **Confidential** | Sensitive operational data; access restricted to the owning cooperative via RLS. Ed25519 public keys, admin addresses. |
| **Restricted** | Cryptographic proof material; integrity must be preserved and access tightly controlled. Ed25519 signatures, reading hashes. |

---

## 2. Table and Field Classification

### `cooperatives`
| Field | Classification | Notes |
|---|---|---|
| `id` | Internal | UUID primary key |
| `name` | Internal | Cooperative display name |
| `admin_address` | Confidential | Stellar public key; not a secret but PII-adjacent — identifies an individual or organisation |
| `created_at` | Internal | |

### `meters`
| Field | Classification | Notes |
|---|---|---|
| `id` | Internal | UUID primary key |
| `cooperative_id` | Internal | Foreign key |
| `serial_number` | Confidential | Physical device identifier |
| `pubkey_hex` | Confidential | Ed25519 public key (32 bytes hex); cryptographic material — exposure enables signature-verification spoofing attempts |
| `active` | Internal | |
| `created_at` | Internal | |

### `readings`
| Field | Classification | Notes |
|---|---|---|
| `id` | Internal | |
| `meter_id` | Internal | |
| `kwh` | Internal | Generation measurement |
| `timestamp` | Internal | |
| `reading_hash` | Restricted | SHA-256 of the reading; integrity anchor — must not be altered |
| `signature_hex` | Restricted | Ed25519 signature (64 bytes hex); cryptographic proof material |
| `anchor_tx_hash` | Public | Stellar transaction hash; publicly visible on-chain |
| `mint_tx_hash` | Public | Stellar transaction hash; publicly visible on-chain |
| `anchored` | Internal | |
| `minted` | Internal | |

### `certificates`
| Field | Classification | Notes |
|---|---|---|
| `id` | Internal | |
| `cooperative_id` | Internal | |
| `reading_id` | Internal | |
| `reading_hash` | Restricted | Mirrors reading integrity anchor |
| `anchor_tx_hash` | Public | |
| `mint_tx_hash` | Public | |
| `kwh` | Public | Certificate energy amount |
| `issued_at` | Internal | |
| `retired` | Public | Retirement status |
| `retired_at` | Internal | |
| `retired_by` | Confidential | Stellar address of retiring party |

---

## 3. Retention Schedules

| Table | Retention Period | Basis |
|---|---|---|
| `readings` | **7 years** from reading timestamp | Regulatory (energy metering compliance) |
| `certificates` | **10 years** from `issued_at` | Compliance (I-REC / certificate audit trail) |
| `meters` | **Lifetime of device** (until decommissioned + 2 years) | Operational; needed to verify historical signatures |
| `cooperatives` | **Lifetime of cooperative** + 2 years | Operational |

Archival (not deletion) is the default action at retention boundary — see §5.

---

## 4. Sensitive Data Controls

- **`pubkey_hex` and `signature_hex`** — cryptographic material. Treated as Confidential/Restricted. Never logged in plaintext. Supabase RLS prevents cross-cooperative reads.
- **`admin_address`** — Stellar public key. Not a cryptographic secret, but links an on-chain identity to an organisation. Treated as Confidential.
- **RLS** — all four tables have Row Level Security enabled (see `supabase/migrations/20240101000003_rls.sql`). Service-role key access is restricted to server-side API routes only.
- **Encryption at rest** — provided by Supabase (AES-256). No additional column-level encryption is currently applied; consider it for `signature_hex` in a future migration if threat model requires it.

---

## 5. Deletion and Archival Procedures

### Archival (preferred)
1. Set `readings.archived = true` and `readings.archived_at = now()` for rows past the 7-year boundary.
2. Export archived rows to cold storage (e.g., S3 Glacier) before purging.
3. Certificates past the 10-year boundary follow the same pattern (add `archived` columns in a future migration when needed).

### Hard deletion
Hard deletion is only permitted:
- On explicit cooperative decommission request, after export confirmation.
- For test/staging data with no regulatory significance.

All deletions must be logged in an external audit log (outside Supabase) with timestamp, actor, and row count.

### Scheduled review
Retention compliance should be reviewed annually. A cron job or Supabase Edge Function should flag rows approaching their retention boundary 90 days in advance.
