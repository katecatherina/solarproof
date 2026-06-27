# Contract Account Rotation — Minter & Admin

This document describes how to safely rotate the `admin` and `minter` accounts for SolarProof's Soroban smart contracts.

---

## Overview

Two privileged roles exist across the contracts:

| Role | Contract | What it controls |
|---|---|---|
| `admin` | `energy_token`, `audit_registry`, `community_governance` | Can rotate minter, upgrade contract state |
| `minter` | `energy_token` | Authorized to call `mint()` |

Rotation should be performed whenever a key is compromised, a team member with key access leaves, or as part of scheduled key hygiene.

---

## Pre-rotation checklist

- [ ] New account funded on Stellar testnet/mainnet (`stellar keys generate`)
- [ ] New account has the new public key noted
- [ ] Existing admin key is available and can sign transactions
- [ ] No in-flight mint operations pending

---

## Rotate the minter (`energy_token`)

Only the current `admin` can call `set_minter`.

```bash
stellar contract invoke \
  --id $ENERGY_TOKEN_ID \
  --source ADMIN_SECRET_KEY \
  --network testnet \
  -- set_minter --new_minter NEW_MINTER_ADDRESS
```

Verify:

```bash
stellar contract invoke \
  --id $ENERGY_TOKEN_ID \
  --source ADMIN_SECRET_KEY \
  --network testnet \
  -- admin
```

---

## Rotate the admin (`energy_token`)

The `energy_token` contract stores admin in instance storage. There is no direct `set_admin` entrypoint — admin rotation requires a contract upgrade or a two-step pattern if one is added. Until then, **protect the admin key with a hardware wallet or multi-sig policy** (see below).

> **Note:** If you need in-contract admin rotation, open an issue to add a `set_admin(new_admin: Address)` entrypoint gated by `admin.require_auth()`.

---

## Rotate the admin (`audit_registry` / `community_governance`)

Same pattern as above — both contracts store admin in instance storage with no `set_admin` entrypoint today. Plan accordingly.

---

## Multi-sig / hardware wallet recommendation

For mainnet deployments, manage admin keys using Stellar multi-sig:

```bash
# Add a co-signer to the admin account
stellar tx new set-options \
  --signer-key CO_SIGNER_PUBLIC_KEY \
  --signer-weight 1 \
  --low-threshold 2 \
  --med-threshold 2 \
  --high-threshold 2 \
  --source ADMIN_SECRET_KEY \
  --network mainnet
```

This requires 2-of-N signatures for any admin transaction.

---

## Emergency revocation

If the minter key is compromised:

1. Immediately call `set_minter` with a new safe address (requires admin key).
2. Audit recent `mint` events on-chain via Stellar Horizon:

```bash
curl "https://horizon-testnet.stellar.org/accounts/$MINTER_ADDRESS/transactions?order=desc&limit=20"
```

3. If the admin key is also compromised, freeze further damage by setting the admin account's thresholds to unreachable values using a co-signer, then redeploy the contract.

---

## Post-rotation checklist

- [ ] `MINTER_SECRET_KEY` env var updated in Vercel (or your deployment platform)
- [ ] Old key revoked / securely deleted
- [ ] Rotation event logged in your team's incident tracker
- [ ] New key stored in a secrets manager (e.g., AWS Secrets Manager, Vault)
