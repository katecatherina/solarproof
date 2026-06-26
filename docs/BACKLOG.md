# Feature Backlog

Planned features not yet scheduled for a sprint. Items are grouped by theme. See the
[ADR directory](adr/) and [CHANGELOG](../CHANGELOG.md) for context on shipped features.

---

## Certificate Lifecycle

### Certificate Retirement Marketplace

**Issue:** [#606](https://github.com/AnnabelJoe/solarproof/issues/606)
**Status:** Backlog
**Priority:** Medium
**Effort:** Large

**Description:**
A marketplace layer that lets certificate holders list retired SolarProof certificates
for discovery by buyers, auditors, and compliance platforms (I-REC, Energy Web, TIGR).

**Motivation:**
Once a certificate is retired on-chain (`energy_token` burn or flag), there is currently
no discovery mechanism for third parties. A marketplace closes the loop between generation
proof and consumption claim, making SolarProof certificates useful for corporate
sustainability reporting and regulatory compliance.

**Proposed scope:**
- On-chain retirement call recorded in `audit_registry` with `retired_by` and `retired_at`
- Public listing API: `GET /api/marketplace` — paginated feed of retired certificates with
  chain-of-custody metadata
- Listing UI on `/marketplace` — searchable by kWh range, issuer, retirement date
- Shareable certificate permalink: `/certificate/:id` with OpenGraph meta for social proof
- Optional: export to I-REC or Energy Web compatible JSON schema

**Dependencies:**
- `energy_token` retirement function (retirement flag or burn — see [ADR-006](adr/006-certificate-retirement-model.md))
- Supabase `certificates` table extended with `retired`, `retired_at`, `retired_by` columns
- E2E scenario for retirement flow (see issue [#596](https://github.com/AnnabelJoe/solarproof/issues/596))

**Acceptance criteria:**
- [ ] Retired certificates are discoverable without login
- [ ] Each listing links to its full chain-of-custody on `/verify`
- [ ] On-chain retirement tx hash is included in every listing
- [ ] Marketplace search returns results in < 500 ms at p95

---

## Infrastructure

_(add items here)_

## Governance

_(add items here)_
