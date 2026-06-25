#!/bin/bash
# Contract Cost Monitoring Script
# Tracks and reports Soroban contract deployment costs (fees, ledger ops, etc.)
# Usage: ./monitor-deployment-cost.sh <contract-name> <wasm-file> <network> <secret-key>

set -euo pipefail

CONTRACT_NAME="${1:?Error: contract name required}"
WASM_FILE="${2:?Error: WASM file path required}"
NETWORK="${3:?Error: network (testnet/mainnet) required}"
SECRET_KEY="${4:?Error: secret key required}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# File size metrics
log_info "Collecting deployment metrics for $CONTRACT_NAME..."

WASM_SIZE=$(stat -f%z "$WASM_FILE" 2>/dev/null || stat -c%s "$WASM_FILE" 2>/dev/null || echo "0")
WASM_SIZE_KB=$((WASM_SIZE / 1024))

log_info "WASM file size: ${WASM_SIZE_KB}KB (${WASM_SIZE} bytes)"

# Record start time
START_TIME=$(date +%s%N)

# Perform deployment and capture output
log_info "Deploying $CONTRACT_NAME to $NETWORK..."

DEPLOY_OUTPUT=$(mktemp)
trap "rm -f $DEPLOY_OUTPUT" EXIT

if stellar contract deploy \
    --wasm "$WASM_FILE" \
    --source "$SECRET_KEY" \
    --network "$NETWORK" > "$DEPLOY_OUTPUT" 2>&1; then
    
    CONTRACT_ID=$(cat "$DEPLOY_OUTPUT")
    END_TIME=$(date +%s%N)
    ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))
    
    log_success "Contract deployed: $CONTRACT_ID"
    log_info "Deployment time: ${ELAPSED_MS}ms"
    
    # Estimate fee from Stellar network
    # Note: Actual fee depends on network state and operation complexity
    BASE_FEE=100 # stroops per operation
    OPERATIONS_EST=3 # estimate: 3 operations (submit, invoke, etc.)
    ESTIMATED_FEE=$((BASE_FEE * OPERATIONS_EST))
    
    log_info "Estimated fee: ${ESTIMATED_FEE} stroops (~0.00001 XLM)"
    
    # Cost breakdown
    cat > deployment-costs.json << EOF
{
  "contract": {
    "name": "$CONTRACT_NAME",
    "id": "$CONTRACT_ID",
    "network": "$NETWORK"
  },
  "wasm": {
    "size_bytes": $WASM_SIZE,
    "size_kb": $WASM_SIZE_KB
  },
  "deployment": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "duration_ms": $ELAPSED_MS,
    "estimated_fee_stroops": $ESTIMATED_FEE,
    "estimated_fee_xlm": "$(echo "scale=8; $ESTIMATED_FEE / 10000000" | bc)"
  },
  "metrics": {
    "wasm_size_kb": $WASM_SIZE_KB,
    "deployment_time_seconds": "$(echo "scale=2; $ELAPSED_MS / 1000" | bc)"
  }
}
EOF
    
    log_success "Cost metrics saved to deployment-costs.json"
    
    # Print summary
    echo ""
    echo "==============================================="
    echo "  CONTRACT DEPLOYMENT COST SUMMARY"
    echo "==============================================="
    echo "Contract:          $CONTRACT_NAME"
    echo "Contract ID:       $CONTRACT_ID"
    echo "Network:           $NETWORK"
    echo "WASM Size:         ${WASM_SIZE_KB}KB"
    echo "Deployment Time:   ${ELAPSED_MS}ms"
    echo "Estimated Fee:     ${ESTIMATED_FEE} stroops"
    echo "==============================================="
    echo ""
    
    # GitHub Actions output
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        echo "contract_id=$CONTRACT_ID" >> "$GITHUB_OUTPUT"
        echo "wasm_size_kb=$WASM_SIZE_KB" >> "$GITHUB_OUTPUT"
        echo "deployment_time_ms=$ELAPSED_MS" >> "$GITHUB_OUTPUT"
        echo "estimated_fee=$ESTIMATED_FEE" >> "$GITHUB_OUTPUT"
    fi
    
    exit 0
else
    log_error "Deployment failed"
    cat "$DEPLOY_OUTPUT" | head -20
    exit 1
fi
