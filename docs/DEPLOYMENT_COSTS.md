# Contract Deployment Cost Monitoring

SolarProof includes automated cost monitoring for Soroban smart contract deployments to track and optimize network fees and resource usage.

---

## Overview

The cost monitoring system captures the following metrics for each contract deployment:

- **WASM File Size** — Binary contract size in bytes and kilobytes
- **Deployment Time** — Time elapsed during deployment process
- **Estimated Fees** — Network fees paid for contract deployment (in stroops)
- **Contract ID** — Unique identifier of the deployed contract
- **Network** — Target network (testnet or mainnet)
- **Timestamp** — When the deployment occurred

---

## Usage

### Local Deployment Monitoring

Monitor deployment costs for a specific contract:

```bash
./scripts/monitor-deployment-cost.sh \
  "energy_token" \
  "apps/contracts/target/wasm32-unknown-unknown/release/energy_token.wasm" \
  "testnet" \
  "$DEPLOYER_SECRET_KEY"
```

**Parameters:**
- `contract_name` — Name of the contract being deployed
- `wasm_file` — Path to the compiled WASM binary
- `network` — Target network (`testnet` or `mainnet`)
- `secret_key` — Deployer's Stellar private key

**Outputs:**
- Cost metrics printed to console
- `deployment-costs.json` file with detailed metrics
- GitHub Actions output variables (if running in Actions)

### CI/CD Integration

The deployment workflow automatically monitors costs for all three contracts:

```bash
# Triggered automatically on push to main or via workflow_dispatch
gh workflow run deploy-contracts.yml -f network=testnet
```

Cost metrics are:
1. **Displayed in workflow summary** — GitHub Actions job summary
2. **Saved as artifacts** — 30-day retention for cost tracking
3. **Logged to console** — Visible in workflow logs

---

## Output Format

### Console Output

```
===============================================
  CONTRACT DEPLOYMENT COST SUMMARY
===============================================
Contract:          energy_token
Contract ID:       CBQHLSNLHVSBS7QV4DQ57FUCLJTLK76D6XWLQP5GKXMRKPLASQNNXSR
Network:           testnet
WASM Size:         256KB
Deployment Time:   1234ms
Estimated Fee:     300 stroops
===============================================
```

### JSON Output (deployment-costs.json)

```json
{
  "contract": {
    "name": "energy_token",
    "id": "CBQHLSNLHVSBS7QV4DQ57FUCLJTLK76D6XWLQP5GKXMRKPLASQNNXSR",
    "network": "testnet"
  },
  "wasm": {
    "size_bytes": 262144,
    "size_kb": 256
  },
  "deployment": {
    "timestamp": "2026-06-25T14:30:45Z",
    "duration_ms": 1234,
    "estimated_fee_stroops": 300,
    "estimated_fee_xlm": "0.00003000"
  },
  "metrics": {
    "wasm_size_kb": 256,
    "deployment_time_seconds": "1.23"
  }
}
```

---

## Cost Analysis

### Factors Affecting Deployment Costs

1. **WASM Binary Size** — Larger contracts may incur higher fees
2. **Network Congestion** — Testnet vs. mainnet fee differences
3. **Account State** — Number of entries and complexity
4. **Operation Type** — Contract deployment is a single operation

### Understanding Stroops

- **1 XLM = 10,000,000 stroops**
- Base fee per operation ≈ 100 stroops
- Typical deployment cost ≈ 300-500 stroops (~0.00003-0.00005 XLM)

### Cost Optimization Tips

1. **Minimize WASM Size**
   - Use release builds with optimizations
   - Remove debug symbols
   - Review dependencies for unnecessary features

2. **Batch Operations**
   - Deploy multiple contracts in a single transaction when possible
   - Reduces per-operation fee overhead

3. **Monitor Trends**
   - Track costs over releases to catch regressions
   - Compare testnet vs. mainnet fees
   - Alert on unexpected cost increases

---

## GitHub Actions Integration

### Workflow Artifact Access

Cost metrics are automatically uploaded as artifacts for every deployment:

```
Artifact Name: deployment-costs-{network}
Retention: 30 days
Location: Actions → Artifacts → deployment-costs-{testnet|mainnet}
```

### Accessing Metrics Programmatically

In a subsequent workflow, retrieve and analyze costs:

```yaml
- name: Download deployment costs
  uses: actions/download-artifact@v4
  with:
    name: deployment-costs-testnet
    path: ./costs

- name: Analyze costs
  run: |
    jq '.deployment.estimated_fee_stroops' costs/deployment-costs.json
```

### GitHub Step Summary

Cost summaries are automatically posted to the workflow run summary:

```markdown
## 📊 Contract Deployment Costs

### energy_token
- Contract ID: CBQHLSNLHVSBS7QV4DQ57FUCLJTLK76D6XWLQP5GKXMRKPLASQNNXSR
- WASM Size: 256KB
- Deployment Time: 1234ms
- Estimated Fee: 300 stroops

### audit_registry
- Contract ID: ...
```

---

## Monitoring Best Practices

1. **Track Costs Over Time**
   - Export metrics to a monitoring system
   - Set up alerts for cost increases > 20%

2. **Compare Across Releases**
   - Keep historical cost data
   - Investigate unexpected changes

3. **Testnet vs. Mainnet**
   - Validate costs on testnet before mainnet deployment
   - Account for fee variations between networks

4. **Alert on Anomalies**
   - Monitor for sudden deployment time increases (potential network issues)
   - Track WASM size regressions (possible bloat in dependencies)

---

## Troubleshooting

### Script Not Finding WASM File

```bash
Error: stat: can't stat file: No such file or directory
```

**Solution:** Ensure the WASM file path is correct relative to the script execution location.

```bash
# Build contracts first
cd apps/contracts && stellar contract build

# Run from repository root
./scripts/monitor-deployment-cost.sh "energy_token" \
  "apps/contracts/target/wasm32-unknown-unknown/release/energy_token.wasm" \
  "testnet" "$SECRET"
```

### Deployment Fails But Script Reports Success

The script captures stderr; check the full output:

```bash
./scripts/monitor-deployment-cost.sh ... 2>&1 | tee deployment.log
```

### Cost Estimates Seem Inaccurate

Current implementation estimates fees based on:
- Base fee: 100 stroops per operation
- Estimated operations: 3 (submit, invoke, etc.)

Actual fees depend on network state. For precise costs, query the Stellar ledger directly or use Stellar's transaction fee simulator.

---

## Integration with Monitoring Services

To send costs to external monitoring services:

```bash
# Example: Send to CloudWatch, Datadog, or Prometheus
curl -X POST https://monitoring-service/api/metrics \
  -H "Content-Type: application/json" \
  -d @deployment-costs.json
```

---

## References

- [Stellar Fees Documentation](https://developers.stellar.org/docs/learn/fundamentals/fees-and-payments)
- [Soroban Contract Deployment](https://developers.stellar.org/docs/build/smart-contracts)
- [Stellar CLI Command Reference](https://developers.stellar.org/docs/tools/stellar-cli)

---

**Last Updated:** June 2026
**Owner:** SolarProof Contributors
