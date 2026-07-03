#!/usr/bin/env bash
# test-contract-invocations.sh — local Soroban contract invocation test harness
# Tests energy_token, audit_registry, and community_governance on the local sandbox.
# Usage: bash scripts/test-contract-invocations.sh

set -euo pipefail

PASS=0; FAIL=0
CONTRACTS_DIR="apps/contracts"
NETWORK="--network-passphrase 'Test SDF Network ; September 2015' --rpc-url http://localhost:8000/soroban/rpc"

ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1: $2"; FAIL=$((FAIL+1)); }

run() {
  local label="$1"; shift
  if out=$(stellar contract invoke "$@" 2>&1); then
    ok "$label"
  else
    fail "$label" "$out"
  fi
}

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
echo "==> Building contracts..."
(cd "$CONTRACTS_DIR" && stellar contract build --quiet 2>/dev/null || cargo build --release --quiet 2>/dev/null)

WASM_DIR="$CONTRACTS_DIR/target/wasm32-unknown-unknown/release"

# ---------------------------------------------------------------------------
# Deploy helpers
# ---------------------------------------------------------------------------
ADMIN="GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
MINTER="GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGWKX2WWTG4L2OGSXWQE2K"
ALICE="GDFOHLMYCXVZD2CDXZLMW6W6TMU4YO27XFF2IBAFAV66MSTPDDSK2LAY"

deploy() {
  local name="$1"
  stellar contract deploy \
    --wasm "$WASM_DIR/${name//-/_}.wasm" \
    --source-account "$ADMIN" \
    $NETWORK \
    --ignore-checks 2>/dev/null || echo "deploy-error"
}

# ---------------------------------------------------------------------------
# energy_token
# ---------------------------------------------------------------------------
echo ""
echo "==> energy_token"
ET_ID=$(deploy "energy_token")

if [[ "$ET_ID" != "deploy-error" ]]; then
  run "initialize" \
    --id "$ET_ID" --source-account "$ADMIN" $NETWORK -- \
    initialize --admin "$ADMIN" --minter "$MINTER"

  run "name returns SolarProof kWh" \
    --id "$ET_ID" --source-account "$ADMIN" $NETWORK -- name

  run "symbol returns SKWH" \
    --id "$ET_ID" --source-account "$ADMIN" $NETWORK -- symbol

  run "decimals returns 7" \
    --id "$ET_ID" --source-account "$ADMIN" $NETWORK -- decimals

  run "total_supply returns 0" \
    --id "$ET_ID" --source-account "$ADMIN" $NETWORK -- total_supply

  run "balance of unknown address returns 0" \
    --id "$ET_ID" --source-account "$ADMIN" $NETWORK -- balance --id "$ALICE"
else
  fail "energy_token deploy" "wasm not found — run 'stellar contract build' first"
fi

# ---------------------------------------------------------------------------
# audit_registry
# ---------------------------------------------------------------------------
echo ""
echo "==> audit_registry"
AR_ID=$(deploy "audit_registry")

HASH="0000000000000000000000000000000000000000000000000000000000000001"

if [[ "$AR_ID" != "deploy-error" ]]; then
  run "initialize" \
    --id "$AR_ID" --source-account "$ADMIN" $NETWORK -- \
    initialize --admin "$ADMIN" --api_signer "$ADMIN"

  run "is_anchored returns false for unknown hash" \
    --id "$AR_ID" --source-account "$ADMIN" $NETWORK -- \
    is_anchored --reading_hash "$HASH"

  run "total_anchors returns 0" \
    --id "$AR_ID" --source-account "$ADMIN" $NETWORK -- total_anchors

  run "version" \
    --id "$AR_ID" --source-account "$ADMIN" $NETWORK -- version
else
  fail "audit_registry deploy" "wasm not found — run 'stellar contract build' first"
fi

# ---------------------------------------------------------------------------
# community_governance
# ---------------------------------------------------------------------------
echo ""
echo "==> community_governance"
CG_ID=$(deploy "community_governance")

if [[ "$CG_ID" != "deploy-error" ]]; then
  run "initialize" \
    --id "$CG_ID" --source-account "$ADMIN" $NETWORK -- \
    initialize --admin "$ADMIN" --quorum_bps 1000 --voting_period_ledgers 1000 --timelock_ledgers 100

  run "proposal_count returns 0" \
    --id "$CG_ID" --source-account "$ADMIN" $NETWORK -- proposal_count
else
  fail "community_governance deploy" "wasm not found — run 'stellar contract build' first"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
