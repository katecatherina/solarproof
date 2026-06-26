# Architecture Diagram & Component Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SolarProof System                              │
└─────────────────────────────────────────────────────────────────────────────┘

  Smart Meter (Ed25519 keypair)
        │
        │  POST /api/readings  { meter_id, kwh, timestamp, signature_hex }
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                        SolarProof API  (Next.js 15)                     │
  │                                                                         │
  │  Route handlers (apps/web/src/app/api/)                                 │
  │  ┌───────────────┐  ┌──────────────────┐  ┌─────────────────────────┐  │
  │  │ POST /readings│  │ GET  /certificates│  │ GET  /api/health        │  │
  │  │               │  │                  │  │                         │  │
  │  │ 1. Verify     │  │ Filter by date,  │  │ Returns { status: ok }  │  │
  │  │    Ed25519 sig│  │ meter, page      │  │ Used by smoke tests     │  │
  │  │ 2. Anchor hash│  │ CSV export       │  └─────────────────────────┘  │
  │  │    on Stellar │  └──────────────────┘                               │
  │  │ 3. Mint token │  ┌──────────────────────────────┐                   │
  │  │ 4. Store cert │  │ POST /certificates/[id]/retire│                  │
  │  └───────────────┘  └──────────────────────────────┘                   │
  │                                                                         │
  │  Shared libraries (apps/web/src/lib/)                                   │
  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────────┐  │
  │  │ stellar.ts │  │supabase.ts │  │  crypto.ts │  │    cache.ts      │  │
  │  │            │  │            │  │            │  │                  │  │
  │  │ anchorRead.│  │ Service +  │  │ Ed25519    │  │ Redis-backed     │  │
  │  │ mintCerts  │  │ anon client│  │ reading    │  │ cert invalidation│  │
  │  │ retireCert │  │ (Supabase) │  │ hash       │  │                  │  │
  │  └────────────┘  └────────────┘  └────────────┘  └──────────────────┘  │
  └─────────────────────────────────────────────────────────────────────────┘
        │                               │
        │ Soroban SDK calls             │ SQL / RLS
        ▼                               ▼
  ┌──────────────────────────┐   ┌──────────────────────────────────────────┐
  │  Stellar Testnet          │   │              Supabase (Postgres)          │
  │                          │   │                                          │
  │  ┌─────────────────────┐ │   │  Tables:                                 │
  │  │   energy_token      │ │   │  • cooperatives  (id, name, admin_addr)  │
  │  │   (SEP-41 token)    │ │   │  • meters        (id, pubkey_hex, active)│
  │  │   1 token = 1 kWh   │ │   │  • readings      (id, kwh, anchored,     │
  │  └─────────────────────┘ │   │                   minted, tx hashes)     │
  │  ┌─────────────────────┐ │   │  • certificates  (id, kwh, retired,      │
  │  │   audit_registry    │ │   │                   anchor_tx, mint_tx)    │
  │  │   immutable anchors │ │   │                                          │
  │  └─────────────────────┘ │   │  RLS: row-level security per cooperative │
  │  ┌─────────────────────┐ │   └──────────────────────────────────────────┘
  │  │community_governance │ │
  │  │proposals + voting   │ │
  │  └─────────────────────┘ │
  └──────────────────────────┘
        ▲
        │  Verify chain of custody
        │
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                       Public Verifier  /verify                          │
  │                                                                         │
  │  Input:  certificate ID or tx hash                                      │
  │  Output: meter reading → Ed25519 proof → ledger anchor → cert → retired │
  └─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### Frontend (`apps/web/src/app/`)

| Route | Component | Description |
|---|---|---|
| `/` | `page.tsx` | Landing page / product overview |
| `/dashboard` | `dashboard/page.tsx` | Operator metrics: kWh totals, certificate counts, charts, recent readings |
| `/certificates` | `certificates/page.tsx` | Certificate history with date/meter filters and CSV export |
| `/verify` | `verify/page.tsx` | Public chain-of-custody verifier (no login required) |

### API Routes (`apps/web/src/app/api/`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Liveness probe used by smoke tests and uptime monitoring |
| `/api/readings` | POST | Accept signed meter reading; verify Ed25519, anchor on Stellar, mint token |
| `/api/certificates` | GET | List certificates with filtering (date, meter) and CSV export |
| `/api/certificates/[id]/retire` | POST | Retire a certificate via the energy_token contract |
| `/api/verify` | GET | Resolve a certificate ID or tx hash to its full audit chain |

### Smart Contracts (`apps/contracts/`)

| Contract | Language | Purpose |
|---|---|---|
| `energy_token` | Rust / Soroban | SEP-41 token — 1 token = 1 kWh; supports mint and retire |
| `audit_registry` | Rust / Soroban | Immutable store of signed meter reading hashes |
| `community_governance` | Rust / Soroban | Cooperative proposals and on-chain voting |

### Shared Packages (`packages/stellar/`)

| Export | Purpose |
|---|---|
| `kwhToStroops(kwh)` | Unit conversion: kWh → Stellar stroops (contract amount) |

### Infrastructure

| Component | Technology | Role |
|---|---|---|
| Hosting | Vercel | Next.js serverless deployment |
| Database | Supabase (Postgres) | Persistent store for readings, meters, certificates |
| Blockchain | Stellar Testnet | On-chain anchoring and certificate tokens |
| Monorepo | Turborepo + pnpm | Build orchestration and workspace management |
| CI | GitHub Actions | Lint, type-check, build, Rust fmt/clippy/test |
| Monitoring | Sentry | Runtime error tracking (client + server + edge) |
| Analytics | Vercel Analytics + Speed Insights | Frontend performance and usage |

---

## Data Flow — Meter Reading to Certificate

```
1. Meter generates Ed25519 keypair (scripts/gen-meter-key.mjs)
2. Meter signs: sign({ meter_id, kwh_in_stroops, timestamp })
3. POST /api/readings with { meter_id, kwh, timestamp, signature_hex }
4. API verifies signature against meter.pubkey_hex from Supabase
5. API computes reading hash = SHA-256(meter_id ‖ kwh_stroops ‖ timestamp)
6. API calls audit_registry.anchor(reading_hash) on Stellar → anchor_tx_hash
7. API calls energy_token.mint(recipient, kwh_stroops) → mint_tx_hash
8. API inserts certificate row in Supabase
9. Operator views certificate on /certificates
10. Auditor verifies full chain on /verify
```

---

## Security Boundaries

- **Meter → API**: Ed25519 signature verification; invalid signatures rejected with 401
- **API → Supabase**: Service role key used server-side only; never exposed to client
- **API → Stellar**: Minter secret key stored as server-side env var (`MINTER_SECRET_KEY`)
- **Client → Supabase**: Anon key with row-level security policies per cooperative
- **Public Verifier**: Read-only, no authentication required
