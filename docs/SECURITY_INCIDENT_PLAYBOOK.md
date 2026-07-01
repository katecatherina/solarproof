# Security Incident Response Playbook — Contract Compromise

This playbook covers response to a suspected or confirmed compromise of SolarProof's Soroban smart contracts or the minter key.

---

## 1. Severity Levels

| Level | Condition | Response Time |
|-------|-----------|--------------|
| P0 | Minter key leaked / unauthorized minting in progress | Immediate (< 1 hour) |
| P1 | Contract upgrade key compromised or suspicious admin call | < 4 hours |
| P2 | Suspected unauthorized anchor write or governance manipulation | < 24 hours |
| P3 | Anomaly detected, impact unclear | < 48 hours |

---

## 2. Detection Sources

- Stellar Explorer transaction alerts on contract addresses
- Supabase log anomalies (unexpected `minted=true` without a valid reading)
- Automated monitoring on `NEXT_PUBLIC_ENERGY_TOKEN_ID` / `NEXT_PUBLIC_AUDIT_REGISTRY_ID`
- GitHub Actions deploy log review
- Community or external reporter via [GitHub Security Advisory](../../security/advisories/new)

---

## 3. Immediate Containment (P0 / P1)

### 3.1 Freeze new deployments

1. Disable the **Deploy Contracts** GitHub Actions workflow:
   - Go to **Actions → Deploy Contracts → ⋯ → Disable workflow**
2. Revoke `DEPLOYER_SECRET_KEY` in GitHub secrets immediately.

### 3.2 Rotate the minter key

```bash
# Generate a replacement minter keypair
stellar keys generate minter-replacement --network mainnet

# Update the on-chain admin via the energy_token contract
stellar contract invoke \
  --id $NEXT_PUBLIC_ENERGY_TOKEN_ID \
  --source <ADMIN_SECRET> \
  --network mainnet \
  -- set_minter --minter <NEW_MINTER_ADDRESS>
```

3. Update `MINTER_SECRET_KEY` in Vercel environment variables and redeploy.

### 3.3 Pause minting in the API

Set the environment variable `MINT_PAUSED=true` in Vercel and redeploy. The readings API checks this flag and returns `503` for mint requests without rejecting anchoring.

---

## 4. Investigation

1. **Export transaction history** for all three contract addresses from the Stellar Horizon API:
   ```bash
   curl "https://horizon.stellar.org/accounts/<CONTRACT_ID>/transactions?limit=200&order=desc"
   ```
2. Identify the first suspicious transaction (unexpected `invoke_contract`, large mint, or unauthorized `set_admin`).
3. Cross-reference with `readings` and `certificates` tables in Supabase to find corresponding records.
4. Capture the full chain: ledger sequence → operation → source account → signing key.

---

## 5. Communication

| Audience | Channel | Timing |
|----------|---------|--------|
| Internal team | Private Slack / Signal | Within 30 min of P0 confirmation |
| Affected cooperatives | Direct email via admin_address on record | Within 2 hours |
| Public disclosure | GitHub Security Advisory (limited details until patched) | After fix is deployed |
| Stellar community | [Stellar Developer Discord](https://discord.gg/stellar) | If Stellar-network-level issue suspected |

Do **not** post key material, exploit details, or transaction IDs in public channels before the fix is deployed.

---

## 6. Recovery

1. **Deploy patched contracts** using the mainnet-gated workflow (requires approver sign-off — see `deploy-contracts.yml`).
2. **Re-initialize contracts** with new admin/minter addresses if keys were rotated.
3. **Audit minted certificates**: query `certificates` table for all records created during the incident window and mark suspect ones `retired=true` with a note.
4. **Re-enable** the deploy workflow and `MINT_PAUSED` flag after verification.

---

## 7. Post-Incident Review

Complete within 5 business days of resolution:

- [ ] Root cause identified and documented
- [ ] Timeline of events written up
- [ ] Affected records in Supabase audited and corrected
- [ ] Monitoring/alerting improved to detect same class of issue earlier
- [ ] `SECURITY.md` updated if scope changes
- [ ] CVE filed if applicable

---

## 8. Contacts

| Role | Contact |
|------|---------|
| On-call engineer | Assign via GitHub `@solarproof/oncall` team |
| Security reporter | GitHub Security Advisories (private) |
| Stellar incident | security@stellar.org |

---

*Last updated: 2026-06-27*
