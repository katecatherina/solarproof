# Production Threat Model Review

> **Status:** Pre-mainnet review — must be resolved before mainnet launch  
> **Last updated:** 2026-06-25  
> **Scope:** SolarProof API, smart contracts, key management, and public verifier

---

## 1. System overview

```
Smart Meter (Ed25519 keypair)
        │  POST /api/readings
        ▼
SolarProof API (Next.js / Vercel)
        │  Supabase (Postgres)
        ▼
Stellar Mainnet (Soroban)
        ├── energy_token
        ├── audit_registry
        └── community_governance
        ▼
Public Verifier  (/verify)
```

Trust boundaries:
- **Meter → API** — untrusted network (public internet)
- **API → Supabase** — service-role key, internal
- **API → Stellar** — minter keypair signs transactions, public network
- **Verifier → API** — unauthenticated public consumers

---

## 2. Threat inventory (STRIDE)

### 2.1 Spoofing

| Threat | Component | Mitigation | Status |
|---|---|---|---|
| Attacker submits reading with fabricated signature | `POST /api/readings` | Ed25519 signature verified against registered meter pubkey | ✅ Implemented |
| Attacker replays a previously valid reading | `POST /api/readings` | Reading hash includes `meter_id + kwh + timestamp`; duplicate hashes rejected by DB unique constraint | ⚠️ **Verify DB constraint exists** |
| Rogue meter registered by attacker | Meter registration flow | Cooperative admin must authorise meter registration | ⚠️ **Review admin auth flow** |

### 2.2 Tampering

| Threat | Component | Mitigation | Status |
|---|---|---|---|
| Database row altered after anchor | Supabase `readings` / `certificates` | Reading hash and anchor tx hash are immutable on-chain — tampered DB rows will fail on-chain verification | ✅ By design |
| Contract upgrade changes token semantics | `energy_token` | Admin key required; upgrade log should be public | ⚠️ **Document upgrade policy** |
| Supply chain attack on npm dependencies | All Node.js code | Use exact versions in `package.json`; run `pnpm audit` in CI | ⚠️ **Add `pnpm audit` to CI** |

### 2.3 Repudiation

| Threat | Component | Mitigation | Status |
|---|---|---|---|
| Minter denies issuing a certificate | Stellar | Every mint recorded on-chain with tx hash | ✅ By design |
| Cooperative admin denies approving a meter | DB | Add `approved_by` + `approved_at` audit columns to `meters` table | ⚠️ **Not yet implemented** |

### 2.4 Information disclosure

| Threat | Component | Mitigation | Status |
|---|---|---|---|
| `signature_hex` exposed in public verifier response | `GET /api/verify` | Currently returned — evaluate whether full signature needs to be public | ⚠️ **Review exposure** |
| Supabase service-role key leaked | API environment | Key stored in Vercel env vars, never in repo; rotate on any suspected leak | ✅ Process defined |
| Minter private key exposed | Stellar | Store in Vercel secret; restrict to API process only | ✅ Process defined |
| Error messages leak internal stack traces | API routes | All errors return a message string, not a stack trace | ✅ Implemented |

### 2.5 Denial of service

| Threat | Component | Mitigation | Status |
|---|---|---|---|
| Flood of POST /api/readings | API | IP rate limiting (10 req/60s) | ✅ Implemented |
| Flood of GET /api/verify | API | IP rate limiting (30 req/60s) | ✅ Implemented |
| Stellar transaction spam driving up fees | Stellar | Rate limiting at API prevents excessive anchoring | ✅ Covered |
| Very large request body | `POST /api/readings` | Next.js default body limit (4 MB); Zod schema rejects wrong field types | ✅ Covered |

### 2.6 Elevation of privilege

| Threat | Component | Mitigation | Status |
|---|---|---|---|
| Non-admin mints tokens directly via contract | `energy_token` | Contract enforces admin-only mint | ✅ Contract-enforced |
| SQL injection via API params | Supabase | Supabase JS SDK uses parameterised queries | ✅ By SDK design |
| Certificate retired by non-owner | `energy_token` | Retirement restricted to token holder | ✅ Contract-enforced |

---

## 3. Open items before mainnet

The following items **must be resolved** before launching on Stellar Mainnet:

| # | Item | Owner | Priority |
|---|---|---|---|
| M-1 | Verify `reading_hash` unique constraint in DB prevents replay attacks | Backend | Critical |
| M-2 | Audit meter registration flow — confirm only cooperative admins can register meters | Backend | Critical |
| M-3 | Document and enforce smart contract upgrade policy (time-lock or multi-sig admin) | Contracts | High |
| M-4 | Add `pnpm audit` (or `npm audit`) step to CI and fail on high/critical vulnerabilities | DevOps | High |
| M-5 | Review whether `signature_hex` should be omitted from the public verifier response | Backend | Medium |
| M-6 | Add `approved_by` / `approved_at` audit columns to `meters` table | Backend | Medium |
| M-7 | Conduct a manual penetration test of all public API endpoints | Security | High |
| M-8 | Perform a third-party audit of all three Soroban smart contracts | Contracts | Critical |
| M-9 | Confirm minter key rotation procedure is documented and tested | DevOps | High |
| M-10 | Validate Vercel environment variable access controls (least-privilege) | DevOps | Medium |

---

## 4. Key assets and risk classification

| Asset | Confidentiality | Integrity | Availability |
|---|---|---|---|
| Minter private key | Critical | Critical | High |
| Supabase service-role key | Critical | High | Medium |
| Meter public keys (DB) | Low | Critical | High |
| Certificate records (DB) | Low | Critical | High |
| Anchor tx hashes (on-chain) | Public | Critical (immutable) | High |

---

## 5. Assumptions and trust boundaries

- Stellar Mainnet nodes are assumed honest (Byzantine fault tolerant via SCP).
- Vercel infrastructure is trusted for secret storage; no secrets in git.
- Meter devices are assumed to be in a physically secure location controlled by the cooperative.
- Supabase RLS policies are **not** currently relied upon for security (service-role key bypasses RLS) — review for mainnet.

---

## 6. Review sign-off

Before mainnet deployment, all Critical and High items in Section 3 must be closed. Record sign-off here:

| Reviewer | Date | Scope | Outcome |
|---|---|---|---|
| (pending) | | Full threat model | |
| (pending) | | Smart contract audit | |
| (pending) | | Penetration test | |
