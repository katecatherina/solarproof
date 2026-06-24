# SolarProof — Smart Contract Security Audit

## Overview

All three Soroban contracts handle real financial value (energy certificates on Stellar).
A professional third-party security audit is required before mainnet launch.

| Item | Detail |
|------|--------|
| **Audit status** | Pre-audit — firm selection in progress |
| **Contracts in scope** | `energy_token`, `audit_registry`, `community_governance` |
| **Target completion** | Before mainnet deployment |
| **Report location** | This directory (`docs/audits/`) |
| **Re-audit policy** | Required after any Critical/High finding remediation or significant contract change |

See [`/docs/AUDIT_SCOPE.md`](../AUDIT_SCOPE.md) for the full technical scope definition.

---

## Audit Firm Selection

### Shortlisted firms (Soroban / Rust / Stellar experience)

| Firm | Specialization | Contact | Status |
|------|---------------|---------|--------|
| Least Authority | Rust, cryptographic protocols | contact@leastauthority.com | Pending RFP |
| OtterSec | Rust smart contracts (Solana/Stellar) | contracts@osec.io | Pending RFP |
| Zellic | Smart contracts, Rust, blockchain | audit@zellic.io | Pending RFP |
| Cure53 | Web/API + cryptography | — | Pending RFP |

> **Action required**: Send the RFP (see `audit-firm-rfp.md`) to at least two firms and
> update this table with responses, quotes, and selected firm.

### Selection criteria

- Demonstrated experience auditing Rust smart contracts
- Familiarity with Soroban SDK / Stellar ecosystem
- Availability to complete initial audit within 4–6 weeks of engagement
- Willingness to perform re-audit after remediation
- References from comparable financial/token contracts

---

## Contracts in Scope

| Contract | Path | Version | Lines (approx.) | Purpose |
|----------|------|---------|-----------------|---------|
| `energy_token` | `apps/contracts/energy_token/src/lib.rs` | 1.0.0 | ~430 | SEP-41 fungible energy certificate token |
| `audit_registry` | `apps/contracts/audit_registry/src/lib.rs` | 1.0.0 | ~340 | Immutable on-chain anchor of meter reading hashes |
| `community_governance` | `apps/contracts/community_governance/src/lib.rs` | 1.0.0 | ~640 | Cooperative proposal + voting with bitmap optimization |

All contracts target **Soroban SDK 23.1.0** on Stellar and are written in Rust.

---

## Audit Timeline

| Phase | Target Date | Owner | Status |
|-------|-------------|-------|--------|
| Firm selection & RFP | TBD | Engineering lead | 🔲 Not started |
| Engagement signed | TBD | Engineering + legal | 🔲 Not started |
| Pre-audit code freeze | TBD | Engineering | 🔲 Not started |
| Initial audit | TBD | Audit firm | 🔲 Not started |
| Preliminary findings delivered | TBD | Audit firm | 🔲 Not started |
| Remediation period | TBD | Engineering | 🔲 Not started |
| Re-audit of Critical/High fixes | TBD | Audit firm | 🔲 Not started |
| Final report published | TBD | Audit firm | 🔲 Not started |

> Update this table as milestones are reached. Set dates once the firm is engaged.

---

## Findings

All findings will be documented here once the audit report is received.
Sections below define the expected structure.

### Critical (must fix before mainnet)

_None identified — audit not yet performed._

### High (must fix before mainnet)

_None identified — audit not yet performed._

### Medium (fix before mainnet or with documented risk acceptance)

_None identified — audit not yet performed._

### Low / Informational

_None identified — audit not yet performed._

---

## Pre-Audit Checklist

The following items must be completed before handing off to the auditing firm.

### Code readiness

- [x] All three contracts compile cleanly (`cargo build --target wasm32-unknown-unknown`)
- [x] Full unit test suite passes (`cargo test --all`)
- [x] Property-based tests pass (`cargo test` in `apps/contracts/proptest/`)
- [x] Fuzz targets defined for `mint`, `anchor`, and `vote`
- [x] No `unwrap()` calls that could cause silent panics on untrusted input
- [x] All access control checks verified (minter-only mint, signer-only anchor, admin-only admin ops)
- [x] Overflow checks present for all i128/u32 arithmetic
- [x] Reentrancy guard in `community_governance::vote()`
- [x] Duplicate anchor prevention (`AlreadyAnchored` error + nonce idempotency)
- [x] Double-vote prevention (bitmap-based, per-voter per-proposal)
- [ ] Persistent storage TTL bump strategy documented

### Documentation readiness

- [x] Inline rustdoc on all public functions
- [x] Invariants documented in module-level comments
- [x] `AUDIT_SCOPE.md` up to date
- [x] Deployment guide in `docs/DEPLOYMENT.md`
- [x] Threat model in `docs/THREAT_MODEL.md`

### Audit deliverables to request

1. Findings report with severity ratings (Critical / High / Medium / Low / Informational)
2. Concrete recommendations for each finding
3. Confirmation of fixed findings after re-audit
4. Final published report (PDF) for inclusion in this directory

---

## Remediation Policy

| Severity | Action required | Timeline |
|----------|----------------|----------|
| Critical | Must be fixed and re-audited before mainnet | Immediately |
| High | Must be fixed and re-audited before mainnet | Before code freeze |
| Medium | Fix before mainnet or provide written risk acceptance | 30 days |
| Low / Info | Fix in next release cycle or accept with documentation | 90 days |

---

## Re-Audit Requirements

A re-audit **must** be performed after any of the following changes:

- Remediation of any Critical or High finding
- Changes to access control logic (mint authorization, anchor signer, admin roles)
- Changes to token supply calculations or burn mechanics
- Changes to voting mechanics or quorum/threshold logic
- Addition of new entry points to any in-scope contract
- Upgrade to a new major version of the Soroban SDK

> When re-audit is triggered, create a new entry in `docs/audits/reaudit-YYYY-MM.md`
> and link it from this file.

---

## Published Reports

| Version | Date | Firm | Scope | Link |
|---------|------|------|-------|------|
| — | — | — | — | Pending first audit |

Reports will be published in this directory as `audit-YYYY-MM-<firm-slug>.pdf`
once received and approved for disclosure.
