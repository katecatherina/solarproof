# Stellar Transaction Troubleshooting Guide

This guide covers common failures when submitting transactions to Stellar/Soroban in the SolarProof stack — meter reading anchors, token mints, and governance votes — along with concrete diagnostic steps and remediation.

---

## Overview: Common Failure Categories

| Category | Typical Symptom |
|---|---|
| Insufficient balance / base reserve | `INSUFFICIENT_BALANCE`, `op_low_reserve` |
| Sequence number mismatch | `tx_bad_seq` |
| Transaction timeout | `tx_too_late`, XDR submission rejected |
| Contract resource limits | `ExceededLimit`, `InvokeHostFunctionResourceLimitExceeded` |
| Authorization failure | `AuthorizationError`, `NotAuthorized` |
| Mint failure (energy_token) | API returns 500, token not received |
| Network / RPC mismatch | Testnet tx sent to mainnet RPC (or vice versa) |

---

## 1. Insufficient XLM Balance / Base Reserve Errors

Stellar requires every account to maintain a **minimum base reserve** of 0.5 XLM per account entry plus 0.5 XLM per additional trustline, offer, or data entry. Soroban contract entries add to this.

**Symptoms**
- `INSUFFICIENT_BALANCE` in Horizon response
- `op_low_reserve` operation result code
- API error: `account cannot afford fee`

**Diagnose**

```bash
# Check account balance and subentry count
stellar account show --account <YOUR_ACCOUNT_ID> --network testnet

# Or query Horizon directly
curl https://horizon-testnet.stellar.org/accounts/<YOUR_ACCOUNT_ID> \
  | jq '{balance: .balances, subentry_count: .subentry_count, min_balance: (.subentry_count * 0.5 + 1)}'
```

The minimum spendable balance = `(2 + subentry_count) * 0.5 XLM`.

**Remediate**

```bash
# Fund account on testnet via Friendbot
curl "https://friendbot.stellar.org/?addr=<YOUR_ACCOUNT_ID>"

# Or transfer XLM from another funded account
stellar tx payment \
  --source <FUNDER_ACCOUNT> \
  --destination <YOUR_ACCOUNT_ID> \
  --asset XLM \
  --amount 10 \
  --network testnet \
  --sign
```

For the SolarProof API service account, ensure `STELLAR_SERVICE_ACCOUNT_SECRET` in `.env.local` corresponds to an account with ≥ 5 XLM available above base reserve before any mint burst.

---

## 2. Transaction Timeout / Sequence Number Errors

**Symptoms**
- `tx_bad_seq` — the transaction sequence number does not match the account's current sequence
- `tx_too_late` — `max_ledger_version` was exceeded before the transaction was included
- `tx_too_early` — `min_ledger_version` not reached yet

**Sequence number mismatch**

This typically happens when multiple concurrent requests share one source account, or when a transaction was built against a stale sequence.

```bash
# Fetch current sequence number for an account
curl https://horizon-testnet.stellar.org/accounts/<ACCOUNT_ID> | jq .sequence

# In code, always reload the account before building a transaction:
#   const account = await server.loadAccount(sourcePublicKey);
#   const tx = new TransactionBuilder(account, { fee, networkPassphrase })
```

Fix: serialize mint requests through a queue (Redis-backed in the SolarProof stack) so only one transaction is in-flight per source account at a time. See `apps/web/src/lib/stellar/queue.ts`.

**Transaction timeout**

Soroban transactions must be submitted within ~30 seconds of construction (before `max_ledger_version` is reached).

```bash
# Check current ledger
curl https://horizon-testnet.stellar.org/ | jq .core_latest_ledger

# Soroban RPC: get latest ledger
curl -X POST https://soroban-testnet.stellar.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger","params":{}}' \
  | jq .result
```

Fix: rebuild and resubmit the transaction immediately. Do not cache built transactions for later submission.

---

## 3. Contract Invocation Errors (Resource Limits & Auth Failures)

### Resource limit exceeded

Soroban enforces per-transaction limits on CPU instructions, memory, ledger reads/writes, and event bytes.

**Symptoms**
- `ExceededLimit` in the simulation response
- `InvokeHostFunctionResourceLimitExceeded` on submission
- RPC `simulateTransaction` returns an error object instead of `results`

**Diagnose**

Always simulate before submitting:

```bash
# Encode your XDR, then simulate
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <ACCOUNT_ID> \
  --network testnet \
  --simulate-only \
  -- mint \
  --to <RECIPIENT> \
  --amount 1000000
```

The simulation response includes `cost` — check `cpuInsns` and `memBytes` against network limits.

**Remediate**
- Break large batch mints into individual transactions
- Reduce the number of ledger entries touched per invocation
- Bump `soroban_resources` fee in `TransactionBuilder` if simulation succeeds but submission fails

### Authorization failure

**Symptoms**
- `AuthorizationError` or `NotAuthorized` in host function result
- `op_not_authorized` in operation result codes

**Diagnose**

```bash
# Check who is the current admin/minter on energy_token
stellar contract invoke \
  --id <ENERGY_TOKEN_CONTRACT_ID> \
  --source <ANY_ACCOUNT> \
  --network testnet \
  -- admin
```

```bash
# Verify the signing key matches the expected admin
stellar keys show <KEY_NAME>
```

**Common causes in SolarProof**
- `STELLAR_ADMIN_SECRET` env var points to a key that is not the contract admin
- Contract was redeployed and the admin was reset — check `docs/deployments.md` for current contract IDs
- `audit_registry` anchor call uses a different key than the one registered for the meter

---

## 4. Mint Failures and tracer-sim Diagnosis

When the SolarProof API's `POST /api/readings` endpoint fails to mint the `energy_token` certificate, the server logs will include a `tracer-sim` diagnostic report.

**How tracer-sim works**

`tracer-sim` replays the failed Soroban transaction locally against the ledger snapshot at the time of failure, producing a step-by-step execution trace with the exact host function that errored and the contract state at that point.

**Reading a tracer-sim report**

```
[tracer-sim] replaying tx <TXHASH>
[tracer-sim] ledger sequence: 12345678
[tracer-sim] invoke energy_token::mint(to=G..., amount=1000000)
[tracer-sim] ERROR at step 42: AuthorizationError
[tracer-sim]   contract_id: C...
[tracer-sim]   function: mint
[tracer-sim]   invoker: G...AAAA  <-- mismatch with admin G...BBBB
```

**Run tracer-sim manually**

```bash
# Replay any failed transaction by hash
npx tracer-sim replay \
  --tx-hash <FAILED_TX_HASH> \
  --network testnet \
  --contract-id <ENERGY_TOKEN_CONTRACT_ID>
```

**Common mint failure causes**

| Cause | tracer-sim signal | Fix |
|---|---|---|
| Wrong admin key | `AuthorizationError` at `mint` | Update `STELLAR_ADMIN_SECRET` |
| Contract ID stale | `contract not found` | Re-run `stellar contract deploy`, update `deployments.md` |
| Recipient has no trustline | `TrustlinesNotAuthorized` | Recipient must add trustline before receiving tokens |
| Fee too low | simulation succeeds, submission fails | Increase `fee` in `TransactionBuilder` |
| Ledger entry TTL expired | `MissingLedgerEntry` | Re-upload contract Wasm and restore entry |

---

## 5. Network Connectivity Issues (Testnet vs Mainnet)

**Symptoms**
- Transactions submitted successfully but never appear on-chain
- `getTransaction` returns `NOT_FOUND` indefinitely
- RPC returns 404 or connection refused

**Verify active network**

```bash
# Show the network configured in stellar CLI
stellar network ls

# Confirm the passphrase your code uses matches the target network
# Testnet:  "Test SDF Network ; September 2015"
# Mainnet:  "Public Global Stellar Network ; September 2015"
```

Check `.env.local`:

```bash
grep STELLAR_NETWORK apps/web/.env.local
# Should be: STELLAR_NETWORK=testnet   (or mainnet for production)
```

**Test RPC connectivity**

```bash
# Soroban RPC health check
curl https://soroban-testnet.stellar.org \
  -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth","params":{}}' \
  | jq .result.status
# Expected: "healthy"

# Horizon health check
curl https://horizon-testnet.stellar.org/health
```

**Testnet resets**

The Stellar testnet resets periodically (roughly quarterly). After a reset:
1. All testnet account balances and contract deployments are wiped
2. Re-fund accounts via Friendbot
3. Redeploy all three contracts and update `docs/deployments.md`
4. Regenerate meter keys via `node scripts/gen-meter-key.mjs`

Check the reset schedule at https://developers.stellar.org/docs/networks/testnet-and-futurenet.

---

## 6. Inspecting Failed Transactions with Stellar Expert and Horizon

### Stellar Expert (UI)

1. Go to https://stellar.expert/explorer/testnet (testnet) or https://stellar.expert/explorer/public (mainnet)
2. Paste the transaction hash or account ID in the search box
3. Open the transaction → **Operations** tab shows each operation result code
4. **Effects** tab shows what state changes were applied (or not)

### Horizon (API)

```bash
# Fetch full transaction detail by hash
curl https://horizon-testnet.stellar.org/transactions/<TX_HASH> | jq .

# Fetch operations for a transaction
curl https://horizon-testnet.stellar.org/transactions/<TX_HASH>/operations | jq .

# Fetch recent transactions for an account
curl "https://horizon-testnet.stellar.org/accounts/<ACCOUNT_ID>/transactions?order=desc&limit=5" \
  | jq '._embedded.records[] | {hash, created_at, successful, result_code: .result_codes}'
```

### Soroban RPC (for contract invocations)

```bash
# Get transaction status (Soroban)
curl -X POST https://soroban-testnet.stellar.org \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getTransaction\",\"params\":{\"hash\":\"<TX_HASH>\"}}" \
  | jq '{status: .result.status, resultXdr: .result.resultXdr}'

# Decode the result XDR to see the host function error
stellar xdr decode --type TransactionResult --xdr <RESULT_XDR>
```

---

## 7. Quick Reference: Error Codes

### Horizon transaction result codes

| Code | Meaning | Typical Cause |
|---|---|---|
| `tx_success` | All operations succeeded | — |
| `tx_failed` | One or more operations failed | Check `operations[].result_codes` |
| `tx_bad_seq` | Wrong sequence number | Concurrent submissions; reload account |
| `tx_too_late` | Submitted after max_ledger | Rebuild and resubmit immediately |
| `tx_too_early` | Submitted before min_ledger | Wait for target ledger |
| `tx_insufficient_fee` | Fee below network minimum | Increase base fee |
| `tx_no_account` | Source account does not exist | Create and fund account |
| `tx_bad_auth` | Invalid signature | Check signing key |
| `tx_internal_error` | Unexpected ledger error | Check Stellar status page |

### Horizon operation result codes

| Code | Meaning |
|---|---|
| `op_success` | Operation succeeded |
| `op_low_reserve` | Account below minimum balance |
| `op_not_authorized` | Account lacks required auth flag |
| `op_no_destination` | Destination account does not exist |
| `op_no_trust` | Recipient has no trustline for asset |
| `op_line_full` | Recipient trustline is at limit |
| `op_underfunded` | Insufficient balance to send |

### Soroban host function error types

| Error | Meaning |
|---|---|
| `AuthorizationError` | Invoker not authorized for function |
| `InvalidInput` | Argument type or value rejected |
| `ExceededLimit` | CPU/memory/ledger resource cap hit |
| `MissingLedgerEntry` | Contract or storage entry not found (TTL expired?) |
| `ContractError(N)` | Contract-defined error — see contract source for code `N` |

For SolarProof contract-specific error codes, see [`docs/CONTRACT_INTERFACE_DOCS.md`](./CONTRACT_INTERFACE_DOCS.md).

---

## See Also

- [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) — deploy and upgrade contracts
- [`docs/deployments.md`](./deployments.md) — current contract IDs per network
- [`docs/METER_INTEGRATION.md`](./METER_INTEGRATION.md) — meter key setup
- [Stellar Developers: Error Codes](https://developers.stellar.org/docs/data/horizon/api-reference/errors/result-codes)
- [Soroban RPC Reference](https://developers.stellar.org/docs/data/rpc/api-reference)
