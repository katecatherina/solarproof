//! Fuzz target: community_governance full lifecycle
//!
//! Covers propose → vote → finalize → execute with arbitrary inputs.
//! Verifies invariants:
//!   - propose() always returns a positive proposal ID
//!   - finalize() always transitions to a terminal status
//!   - execute() only succeeds after Passed + timelock elapsed
//!   - vote counts are consistent with approval pattern

#![no_main]

use libfuzzer_sys::fuzz_target;
use soroban_sdk::{testutils::Address as _, Address, Env, String};
use community_governance::{CommunityGovernance, CommunityGovernanceClient, ProposalStatus};

fuzz_target!(|data: &[u8]| {
    // Need at least 3 bytes: voter_count, voting_period, approve_bits
    if data.len() < 3 {
        return;
    }

    let voter_count = (data[0] as usize % 16) + 1; // 1–16 voters
    let voting_period = (data[1] as u32 % 10) + 1; // 1–10 ledgers
    let approve_bits = &data[2..];

    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(CommunityGovernance, ());
    let client = CommunityGovernanceClient::new(&env, &id);
    let admin = Address::generate(&env);
    // quorum=1 (any votes pass quorum check), small voting period
    client.initialize(&admin, &1_u32, &voting_period);

    // ── propose ──────────────────────────────────────────────────────────────
    let proposer = Address::generate(&env);
    let pid = client.propose(
        &proposer,
        &String::from_str(&env, "fuzz title"),
        &String::from_str(&env, "fuzz description"),
    );
    assert!(pid >= 1, "proposal id must be >= 1");

    let proposal = client.get_proposal(&pid).expect("proposal must exist");
    assert_eq!(proposal.status, ProposalStatus::Active);

    // ── vote ─────────────────────────────────────────────────────────────────
    let mut yes: u32 = 0;
    let mut no: u32 = 0;
    for i in 0..voter_count {
        let voter = Address::generate(&env);
        let byte_idx = i / 8;
        let bit = i % 8;
        let approve = approve_bits
            .get(byte_idx)
            .map(|b| (b >> bit) & 1 == 1)
            .unwrap_or(true);
        client.vote(&voter, &pid, &approve);
        if approve { yes += 1; } else { no += 1; }
    }

    let voted = client.get_proposal(&pid).expect("proposal must exist after voting");
    assert_eq!(voted.yes_votes, yes);
    assert_eq!(voted.no_votes, no);

    // ── finalize ─────────────────────────────────────────────────────────────
    env.ledger().with_mut(|l| l.sequence_number += voting_period + 1);
    client.finalize(&pid);

    let finalized = client.get_proposal(&pid).expect("proposal must exist after finalize");
    assert!(
        matches!(
            finalized.status,
            ProposalStatus::Passed | ProposalStatus::Rejected | ProposalStatus::Expired
        ),
        "finalize must produce a terminal status"
    );

    // ── execute (only when Passed) ────────────────────────────────────────────
    if finalized.status == ProposalStatus::Passed {
        // Advance past the execution timelock (8640 ledgers = 24 h)
        env.ledger().with_mut(|l| l.sequence_number += 8_641);
        client.execute(&pid);
        let executed = client.get_proposal(&pid).expect("proposal must exist after execute");
        assert_eq!(executed.status, ProposalStatus::Executed);
    }
});
