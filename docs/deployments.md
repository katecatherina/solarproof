# Contract Deployments

Deployed contract addresses for each environment. Update this file after every deployment.

> **Placeholder convention:** Values shown as `<PLACEHOLDER>` have not been filled in yet
> and must be replaced with the real 56-character Stellar contract ID (starting with `C`)
> before the environment is functional.  Values shown as `_(not yet deployed)_` mean the
> contract has never been deployed to that network.

---

## Testnet

| Contract | Contract ID | Deployed At | Deployed By |
|---|---|---|---|
| `energy_token` | `<TESTNET_ENERGY_TOKEN_ID>` | — | — |
| `audit_registry` | `<TESTNET_AUDIT_REGISTRY_ID>` | — | — |
| `community_governance` | `<TESTNET_COMMUNITY_GOVERNANCE_ID>` | — | — |

Explorer: `https://stellar.expert/explorer/testnet/contract/<CONTRACT_ID>`

### Required environment variables (testnet)

After deploying, set the following in your `.env.local` (see `.env.example`):

```env
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_ENERGY_TOKEN_ID=<TESTNET_ENERGY_TOKEN_ID>
NEXT_PUBLIC_AUDIT_REGISTRY_ID=<TESTNET_AUDIT_REGISTRY_ID>
NEXT_PUBLIC_COMMUNITY_GOVERNANCE_ID=<TESTNET_COMMUNITY_GOVERNANCE_ID>
MINTER_SECRET_KEY=<your-testnet-deployer-secret>
```

---

## Mainnet

| Contract | Contract ID | Deployed At | Deployed By |
|---|---|---|---|
| `energy_token` | _(not yet deployed)_ | — | — |
| `audit_registry` | _(not yet deployed)_ | — | — |
| `community_governance` | _(not yet deployed)_ | — | — |

Explorer: `https://stellar.expert/explorer/public/contract/<CONTRACT_ID>`

### Required environment variables (mainnet)

```env
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-rpc.stellar.org
NEXT_PUBLIC_ENERGY_TOKEN_ID=<MAINNET_ENERGY_TOKEN_ID>
NEXT_PUBLIC_AUDIT_REGISTRY_ID=<MAINNET_AUDIT_REGISTRY_ID>
NEXT_PUBLIC_COMMUNITY_GOVERNANCE_ID=<MAINNET_COMMUNITY_GOVERNANCE_ID>
MINTER_SECRET_KEY=<your-mainnet-deployer-secret>
```

> ⚠️ Mainnet deployments are irreversible. Use a hardware wallet or HSM-backed key.
> Never commit real secret keys — use GitHub Actions secrets in CI/CD.

---

## How to update this file

1. Run the deploy workflow (`GitHub → Actions → Deploy Contracts → Run workflow`) or follow the manual steps in [docs/DEPLOYMENT.md](DEPLOYMENT.md).
2. The `stellar contract deploy` command prints a contract ID for each contract.
3. Replace the corresponding `<PLACEHOLDER>` value in the table above with the real contract ID.
4. Set the same IDs in the matching environment variables listed above (`.env.local` for local dev, GitHub / Vercel secrets for CI/CD).
5. Commit the updated file.
