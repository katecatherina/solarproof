# Product Backlog

## Hardware Meter Provisioning UX

**Issue:** [#613](https://github.com/AnnabelJoe/solarproof/issues/613)  
**Category:** Backlog  
**Priority:** High  
**Product Level:** 2 (Hardware HSM Integration)

### Problem

There is currently no UI or guided workflow for onboarding a new hardware smart meter into a cooperative. Operators must manually generate Ed25519 keypairs via CLI scripts (`scripts/gen-meter-key.mjs`), register the public key in the database, and configure the device — a process that is error-prone and not accessible to non-technical cooperative administrators.

### Proposed Solution

Build a hardware meter provisioning flow inside the SolarProof dashboard that guides an admin through the full lifecycle of registering a new meter device.

### User Stories

- As a **cooperative admin**, I want a step-by-step UI to register a new smart meter so that I don't need CLI access.
- As a **cooperative admin**, I want to upload or paste a meter's Ed25519 public key and serial number so that it is securely stored and linked to my cooperative.
- As a **cooperative admin**, I want to view all provisioned meters and their active/inactive status so that I can manage the fleet.
- As a **field technician**, I want a QR-code or copy-paste flow for transferring the meter public key from the device so that provisioning is fast and error-free.

### Acceptance Criteria

- [ ] `/dashboard/meters/new` page with a multi-step form: serial number → public key input → confirmation.
- [ ] Ed25519 public key validated (must be 64 hex chars = 32 bytes) before submission.
- [ ] On submit, meter row inserted into `meters` table linked to the admin's cooperative.
- [ ] Success screen shows the new meter's ID and a copyable onboarding summary.
- [ ] Meter list page at `/dashboard/meters` shows status, serial, and last-reading timestamp.
- [ ] Deactivate/reactivate action available per meter row.

### Technical Notes

- API: extend `POST /api/meters` (new route) and `PATCH /api/meters/[id]` for activate/deactivate.
- Validation: reuse the `pubkey_hex` column constraint (64 hex chars) from the `meters` DB schema.
- Auth: only the cooperative's admin address may provision meters for their cooperative.
- Consider YubiKey/TPM support (Level 2 roadmap) — keep the public key input generic enough to support HSM-exported keys.
