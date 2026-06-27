# Release Checklist

Actionable checklist for releasing SolarProof. Complete every step in order; do not skip items for mainnet releases.

---

## Pre-Release Checks

- [ ] All CI checks pass on the release branch (`pnpm test`, `cargo test`)
- [ ] Smart contracts audited (or audit waived with documented justification)
- [ ] No `TODO`/`FIXME` comments in contract code intended for this release
- [ ] `CHANGELOG.md` updated with release notes
- [ ] Version bumped in `package.json` and `Cargo.toml` files
- [ ] All required environment variables documented in `.env.example`
- [ ] Secrets confirmed set in CI / Vercel (see env var list below)
- [ ] `docs/deployments.md` reflects current contract addresses for this network

### Required environment variables

| Variable | Where set |
|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | Vercel / `.env.local` |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | Vercel / `.env.local` |
| `NEXT_PUBLIC_ENERGY_TOKEN_ID` | Vercel / `.env.local` |
| `NEXT_PUBLIC_AUDIT_REGISTRY_ID` | Vercel / `.env.local` |
| `NEXT_PUBLIC_COMMUNITY_GOVERNANCE_ID` | Vercel / `.env.local` |
| `MINTER_SECRET_KEY` | Vercel (encrypted) |
| `SUPABASE_URL` | Vercel (encrypted) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (encrypted) |
| `DEPLOYER_SECRET` | GitHub Actions secret |

---

## Testnet Deployment

1. **Build contracts**
   ```bash
   cd apps/contracts
   stellar contract build
   ```

2. **Deploy & initialize** — follow [DEPLOYMENT.md §2](DEPLOYMENT.md#2-deploy-to-testnet)

3. **Record addresses** — update `docs/deployments.md` with new contract IDs

4. **Set env vars** — copy new contract IDs into Vercel (testnet project) or `.env.local`

5. **Deploy web app**
   ```bash
   # Vercel CI deploys automatically on merge to main.
   # For a manual deploy:
   vercel --prod
   ```

---

## Mainnet Deployment

> ⚠️ Irreversible. Use a hardware wallet or HSM-backed key. Have the rollback procedure ready before starting.

1. Complete all pre-release checks above
2. Build contracts (same as testnet)
3. **Deploy with mainnet flag** — follow [DEPLOYMENT.md §3](DEPLOYMENT.md#3-deploy-to-mainnet)
4. **Verify bytecode** — follow [DEPLOYMENT.md §5](DEPLOYMENT.md#5-verify-deployed-bytecode-on-stellar-expert); hashes must match before proceeding
5. Record mainnet contract IDs in `docs/deployments.md`
6. Update Vercel (mainnet project) env vars with new contract IDs
7. Deploy web app and confirm Vercel build succeeds

---

## Post-Deployment Verification

- [ ] Stellar Expert shows correct WASM hash for each contract ([verify](https://stellar.expert))
- [ ] `/api/health` returns `200 OK`
- [ ] Submit a test meter reading via `scripts/send-reading.mjs`; confirm it anchors on-chain
- [ ] Mint one certificate via the dashboard; confirm token balance increases
- [ ] Public verifier at `/verify` resolves the test certificate
- [ ] Governance proposal creation and vote cast successfully
- [ ] Supabase rows written for the test reading and certificate

---

## Rollback Procedure

Soroban contracts are immutable — rollback means deploying corrected code as a **new contract**.

1. **Deploy corrected WASM** (new contract ID produced)
2. **Update env vars** in Vercel to point to the new contract IDs
3. **Redeploy web app** — Vercel picks up new vars on next deployment
4. **Update `docs/deployments.md`** — record new IDs and a note explaining the rollback
5. **Do not delete the old contract** — it stays on-chain as an audit record

For `audit_registry` specifically: historical anchors remain valid on the old contract ID. New readings anchor to the new contract; existing certificates resolve via stored `anchor_explorer` links.

See [DEPLOYMENT.md §6](DEPLOYMENT.md#6-rollback-procedure) for the full rollback guide.

---

## Post-Release

- [ ] Git tag created: `git tag -s vX.Y.Z -m 'Release vX.Y.Z'`
- [ ] Tag pushed: `git push origin vX.Y.Z`
- [ ] GitHub Release drafted with `CHANGELOG.md` notes
- [ ] Team notified in the project channel
