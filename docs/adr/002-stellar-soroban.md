# ADR-002: Stellar/Soroban over EVM

**Date:** 2026-04-23  
**Status:** Accepted

## Context

SolarProof requires a smart contract platform to anchor meter readings and mint energy certificates. Key requirements:

- Low, predictable transaction fees (high-frequency meter anchoring)
- Native Ed25519 signature verification
- Deterministic execution for auditability
- Active ecosystem and tooling

## Decision

Deploy on **Stellar** using **Soroban** smart contracts.

## Consequences

**Positive:**
- Stellar's base fee (~0.00001 XLM) makes per-reading anchoring economically viable at scale
- Soroban provides `env.crypto().ed25519_verify()` natively — no external oracle or precompile needed
- Deterministic Wasm execution simplifies audit and replay via `tracer-sim`
- Stellar's 5-second ledger close time gives near-real-time anchoring

**Negative:**
- Smaller developer ecosystem than EVM — fewer off-the-shelf integrations
- Soroban is newer; some tooling is less mature than Ethereum equivalents
- Bridging to EVM-based certificate markets (I-REC, Energy Web) requires future work (Level 3 roadmap)

## Soroban fee estimation and transaction gas behavior

Soroban transaction costs are governed by contract resource usage and transaction inclusion fees.

- `--resource-fee` is the Soroban resource budget in stroops (1 stroop = 0.0000001 XLM).
- `--inclusion-fee` is the fee for network inclusion, analogous to Stellar base fee.
- `--cost` prints the estimated resource cost during simulation.
- `--send=no` simulates the transaction without submitting it.
- `--instruction-leeway` allows extra instruction budget for higher-complexity contract calls.
- `--auth-mode` controls how Soroban authorization entries are validated during simulation.

### Estimation workflow

Simulate contract calls before sending them to avoid unexpected failures and to tune fees:

```bash
stellar contract invoke --id <CONTRACT_ID> --source YOUR_SECRET --network testnet \
  --send=no --cost -- mint --to GABC...XYZ --amount 10000000
```

If a call fails due to resource budget limits, increase the budget:

```bash
stellar contract invoke --id <CONTRACT_ID> --source YOUR_SECRET --network testnet \
  --send=no --cost --resource-fee 200 --instruction-leeway 50 -- mint --to GABC...XYZ --amount 10000000
```

### Practical behavior

Soroban execution is deterministic: a transaction either succeeds and pays the measured resource cost, or it fails and the attempted resources are still accounted for. For SolarProof, common operations like anchoring a reading or minting a certificate are intentionally lightweight. More stateful operations such as governance voting may require higher resource budgets, so simulation should be part of the deployment and troubleshooting workflow.
