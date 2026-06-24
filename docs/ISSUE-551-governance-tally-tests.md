# Issue #551 — Governance tally and edge-case tests

This file lists tests to add for governance tally logic and potential edge cases.

## Targets for tests

- Correctness of vote tallying with large numbers of voters.
- Tie-breaking behavior when votes are equal.
- Handling of missing or malformed ballots.
- Time boundary conditions (votes arriving exactly at deadline).

## Suggested test cases

- Tally with 0, 1, and many voters.
- Votes containing unexpected option values should be rejected.
- Ensure deterministic outcome for tie (document chosen strategy).

## Notes
- Implement these tests in the governance crate under `apps/contracts/community_governance` where the tally logic resides.
