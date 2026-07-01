---
title: Contract Upgradeability and Migration Plan
status: draft
---

## Summary

This ADR describes a minimal upgradeability and migration strategy for Soroban contracts used by Solarproof. It outlines governance, versioning, on-chain migration steps, and off-chain rollout considerations.

## Goals

- Allow safe contract upgrades when necessary (bugfixes, state migrations).
- Ensure transparency and auditability of migration steps.
- Minimize user impact and avoid loss of funds/certificates.

## Approach

1. Use a governance-controlled `upgrade` entrypoint in `community_governance` to authorize new contract code hashes.
2. Publish a detailed migration plan in this repository for each upgrade, including audit results and rollback steps.
3. For state migrations that require on-chain transformations, implement an on-chain migration entrypoint that is idempotent and emits events for observability.
4. Require a multi-signer governance approval and a time delay (timelock) before executing upgrades in production.

## Rollout

- Deploy new contract code to a testnet and run integration tests and a migration dry-run.
- Open a GitHub PR that contains the migration scripts, new contract artifacts, and a changelog linking to audits.
- After community/governance approval and timelock, execute the upgrade and monitor logs and metrics.

## Notes

This ADR is intentionally high-level; specific upgrade procedures should be recorded per-upgrade in the PR that performs the migration.
