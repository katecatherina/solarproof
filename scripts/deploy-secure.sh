#!/usr/bin/env bash
set -euo pipefail

# Usage: NETWORK=testnet STELLAR_SECRET_KEY=S... ./scripts/deploy-secure.sh

REQUIRED_VARS=(STELLAR_SECRET_KEY NETWORK)

for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: required env var '$var' is not set" >&2
    exit 1
  fi
done

if [[ "$NETWORK" != "testnet" && "$NETWORK" != "mainnet" ]]; then
  echo "Error: NETWORK must be 'testnet' or 'mainnet'" >&2
  exit 1
fi

RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
[[ "$NETWORK" == "mainnet" ]] && RPC_URL="${STELLAR_RPC_URL:-https://soroban-mainnet.stellar.org}"

CONTRACTS_DIR="apps/contracts"
MANIFEST="deployments/${NETWORK}.json"
mkdir -p deployments

echo "Deploying to $NETWORK..."

deploy_contract() {
  local name="$1"
  local wasm_path="$CONTRACTS_DIR/$name/target/wasm32-unknown-unknown/release/${name}.wasm"
  local contract_id
  contract_id=$(stellar contract deploy \
    --wasm "$wasm_path" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$([ "$NETWORK" = "mainnet" ] && echo "Public Global Stellar Network ; September 2015" || echo "Test SDF Network ; September 2015")" \
    2>/dev/null)
  echo "$contract_id"
}

ENERGY_TOKEN_ID=$(deploy_contract energy_token)
AUDIT_REGISTRY_ID=$(deploy_contract audit_registry)
COMMUNITY_GOVERNANCE_ID=$(deploy_contract community_governance)

cat > "$MANIFEST" <<EOF
{
  "network": "$NETWORK",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "energy_token": "$ENERGY_TOKEN_ID",
    "audit_registry": "$AUDIT_REGISTRY_ID",
    "community_governance": "$COMMUNITY_GOVERNANCE_ID"
  }
}
EOF

echo "Manifest written to $MANIFEST"
cat "$MANIFEST"
