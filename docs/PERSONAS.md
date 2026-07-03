# Product Personas

SolarProof serves three core user personas. Each has distinct goals and primary workflows.

---

## 1. Auditor

**Who they are:** Regulatory compliance officers, third-party verifiers, or government agency staff who need to confirm that issued renewable energy certificates correspond to real, tamper-evident meter readings.

**Primary goals:**
- Verify the cryptographic chain of custody from meter reading to on-chain certificate
- Confirm no duplicate or fabricated certificates exist
- Export audit trails for regulatory filings

**Key user stories:**

| # | Story |
|---|-------|
| A1 | As an auditor, I can enter a certificate ID or tx hash on `/verify` and see the full chain: meter → Ed25519 signature → ledger anchor → certificate — without needing a login. |
| A2 | As an auditor, I can confirm the Ed25519 public key of the signing meter matches the key registered for that device. |
| A3 | As an auditor, I can query all certificates issued for a cooperative within a date range and download a CSV report. |
| A4 | As an auditor, I can see whether a certificate has been retired (burned) and by whom. |

**Feature implications:**
- Public `/verify` page must remain login-free and show every field in the `AuditAnchor` struct
- Certificate list view needs date-range filtering and CSV export
- Retirement events must be recorded on-chain and surfaced in the verifier

---

## 2. Cooperative

**Who they are:** Energy cooperative administrators who aggregate output from multiple member meters, receive minted certificates, manage retirements, and interact with the governance contract.

**Primary goals:**
- Monitor total generation across their meter fleet in real time
- Manage certificate issuance and retirement on behalf of members
- Participate in community governance (proposals, voting)

**Key user stories:**

| # | Story |
|---|-------|
| C1 | As a cooperative admin, I can see a dashboard of kWh generated, certificates minted, and certificates retired for all my meters. |
| C2 | As a cooperative admin, I can register a new meter (serial number + Ed25519 public key) and assign it to my cooperative. |
| C3 | As a cooperative admin, I can retire (burn) a certificate and record the buyer's details. |
| C4 | As a cooperative admin, I can submit a governance proposal and vote on open proposals using my Stellar wallet. |
| C5 | As a cooperative admin, I receive email/webhook notifications when a reading fails to anchor or mint. |

**Feature implications:**
- Dashboard page must scope data to `cooperative_id` from the authenticated session
- Meter registration UI needed (creates row in `meters` table)
- Retirement flow must call `energy_token.burn()` and update the `certificates` table
- Governance UI must wrap the `community_governance` contract

---

## 3. Meter Operator

**Who they are:** Technicians or site managers responsible for installing, configuring, and maintaining smart meters. They interact with the system primarily via CLI scripts and device firmware.

**Primary goals:**
- Generate and securely store an Ed25519 keypair on each meter
- Validate that readings are being correctly signed and accepted by the API
- Diagnose failed anchors or mints

**Key user stories:**

| # | Story |
|---|-------|
| M1 | As a meter operator, I can run `gen-meter-key.mjs` to generate a keypair and receive a public key to register with my cooperative. |
| M2 | As a meter operator, I can run `send-reading.mjs` to test that a signed reading (including optional metadata) is accepted by the API end-to-end. |
| M3 | As a meter operator, I can view the last 10 readings for a given meter ID and see whether each was anchored and minted. |
| M4 | As a meter operator, I can include signed device metadata (firmware version, hardware model) in a reading payload so device identity is cryptographically bound to the reading. |
| M5 | As a meter operator, I receive a clear error message if an anchor or mint fails, along with the `tracer-sim` replay link for diagnosis. |

**Feature implications:**
- Meter readings list view scoped by `meter_id` (no login required for operators given a meter ID)
- `send-reading.mjs` must expose `--firmware`, `--model`, `--manufacturer` flags (see issue #547)
- API error responses for failed anchors must include the tx hash and a tracer-sim URL

---

## How personas inform prioritisation

| Priority | Feature | Persona |
|----------|---------|---------|
| P0 | Public verifier (login-free, full chain of custody) | Auditor |
| P0 | Certificate issuance + retirement | Cooperative |
| P1 | Cooperative dashboard (fleet kWh, cert status) | Cooperative |
| P1 | Meter registration UI | Cooperative + Operator |
| P1 | Signed metadata payloads | Operator |
| P2 | CSV export / date-range filter | Auditor |
| P2 | Governance UI | Cooperative |
| P2 | Failure notifications (email/webhook) | Cooperative + Operator |
| P3 | tracer-sim replay links in error responses | Operator |
