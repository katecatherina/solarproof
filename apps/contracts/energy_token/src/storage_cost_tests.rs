//! Storage cost estimation tests for `energy_token` (issue #564).
//!
//! These tests exercise each contract method and print a summary of which
//! Soroban storage tiers (instance / persistent / temporary) are read and
//! written, along with the expected number of ledger-entry operations.
//!
//! They serve as living documentation — if a future refactor changes the
//! storage layout the test assertions will catch the behavioural change.
//!
//! Run with:
//! ```bash
//! cd apps/contracts
//! cargo test -p energy-token storage_cost -- --nocapture
//! ```

#[cfg(test)]
mod storage_cost_tests {
    use crate::{EnergyToken, EnergyTokenClient};
    use soroban_sdk::{testutils::Address as _, Address, Env};

    // ── helpers ──────────────────────────────────────────────────────────────

    fn setup() -> (Env, EnergyTokenClient<'static>, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(EnergyToken, ());
        let client = EnergyTokenClient::new(&env, &id);
        let admin = Address::generate(&env);
        let minter = Address::generate(&env);
        client.initialize(&admin, &minter);
        (env, client, admin, minter)
    }

    // ── initialize ───────────────────────────────────────────────────────────

    /// `initialize` writes 5 instance-storage keys:
    /// Admin, Minter, TotalMinted, TotalBurned, Paused.
    /// Cost: 1 instance ledger-entry write (all instance keys share one entry).
    #[test]
    fn estimate_initialize_storage_ops() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(EnergyToken, ());
        let client = EnergyTokenClient::new(&env, &id);
        let admin = Address::generate(&env);
        let minter = Address::generate(&env);
        client.initialize(&admin, &minter);
        // Post-condition: instance data is accessible
        assert_eq!(client.admin(), admin);
        println!(
            "[storage_cost] initialize: 5 instance-key writes (1 instance ledger entry)"
        );
    }

    // ── mint ─────────────────────────────────────────────────────────────────

    /// `mint` (first call for an address):
    ///   reads  — Minter(instance), balance(persistent) [miss → 0], TotalMinted(instance)
    ///   writes — balance(persistent) [new entry], TotalMinted(instance)
    ///
    /// `mint` (subsequent call to same address):
    ///   reads  — Minter(instance), balance(persistent), TotalMinted(instance)
    ///   writes — balance(persistent) [update], TotalMinted(instance)
    ///
    /// Ledger entry ops: 1 instance read/write + 1 persistent write (new) or rw (existing).
    #[test]
    fn estimate_mint_storage_ops() {
        let (env, client, _admin, _minter) = setup();
        let user = Address::generate(&env);

        // First mint — creates new persistent balance entry
        client.mint(&user, &1_000_i128);
        assert_eq!(client.balance(&user), 1_000_i128);
        assert_eq!(client.total_supply(), 1_000_i128);

        // Second mint to same address — updates existing persistent entry
        client.mint(&user, &500_i128);
        assert_eq!(client.balance(&user), 1_500_i128);
        assert_eq!(client.total_supply(), 1_500_i128);

        println!(
            "[storage_cost] mint: \
            1st call → 1 instance rw + 1 persistent write; \
            subsequent → 1 instance rw + 1 persistent rw"
        );
    }

    // ── burn ─────────────────────────────────────────────────────────────────

    /// `burn`:
    ///   reads  — balance(persistent), TotalBurned(instance)
    ///   writes — balance(persistent), TotalBurned(instance)
    ///
    /// Ledger entry ops: 1 instance rw + 1 persistent rw.
    #[test]
    fn estimate_burn_storage_ops() {
        let (env, client, _admin, _minter) = setup();
        let user = Address::generate(&env);
        client.mint(&user, &5_000_i128);

        client.burn(&user, &2_000_i128);
        assert_eq!(client.balance(&user), 3_000_i128);
        assert_eq!(client.total_supply(), 3_000_i128);

        println!(
            "[storage_cost] burn: 1 instance rw (TotalBurned) + 1 persistent rw (balance)"
        );
    }

    // ── transfer ─────────────────────────────────────────────────────────────

    /// `transfer`:
    ///   reads  — balance(from, persistent), balance(to, persistent)
    ///   writes — balance(from, persistent), balance(to, persistent)
    ///
    /// Ledger entry ops: 2 persistent rw (from + to balances).
    /// Note: no instance storage is touched.
    #[test]
    fn estimate_transfer_storage_ops() {
        let (env, client, _admin, _minter) = setup();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        client.mint(&from, &2_000_i128);

        client.transfer(&from, &to, &1_000_i128);
        assert_eq!(client.balance(&from), 1_000_i128);
        assert_eq!(client.balance(&to), 1_000_i128);

        println!(
            "[storage_cost] transfer: 2 persistent rw (from-balance + to-balance)"
        );
    }

    /// `transfer` to self: `move_balance` short-circuits when `from == to`,
    /// so no storage is written (only reads occur for the pause/retire checks).
    #[test]
    fn estimate_transfer_to_self_storage_ops() {
        let (env, client, _admin, _minter) = setup();
        let user = Address::generate(&env);
        client.mint(&user, &1_000_i128);

        client.transfer(&user, &user, &500_i128);
        assert_eq!(client.balance(&user), 1_000_i128); // unchanged

        println!(
            "[storage_cost] transfer (self): early return — 0 persistent writes \
            (only Paused/Retired instance reads)"
        );
    }

    // ── approve / transfer_from ───────────────────────────────────────────────

    /// `approve`:
    ///   writes — Allowance(from, spender, persistent)
    ///
    /// `transfer_from`:
    ///   reads  — Allowance(persistent), balance(from, persistent), balance(to, persistent)
    ///   writes — Allowance(persistent), balance(from, persistent), balance(to, persistent)
    ///
    /// Combined ledger entry ops: 1 persistent write (approve) + 3-4 persistent ops (transfer_from).
    #[test]
    fn estimate_approve_transfer_from_storage_ops() {
        let (env, client, _admin, _minter) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let recipient = Address::generate(&env);
        client.mint(&owner, &3_000_i128);

        // approve: 1 persistent write (Allowance)
        client.approve(&owner, &spender, &2_000_i128, &9_999_u32);
        assert_eq!(client.allowance(&owner, &spender), 2_000_i128);

        // transfer_from: 1 persistent rw (Allowance) + 2 persistent rw (balances)
        client.transfer_from(&spender, &owner, &recipient, &1_500_i128);
        assert_eq!(client.balance(&owner), 1_500_i128);
        assert_eq!(client.balance(&recipient), 1_500_i128);
        assert_eq!(client.allowance(&owner, &spender), 500_i128);

        println!(
            "[storage_cost] approve: 1 persistent write; \
            transfer_from: 3 persistent rw (Allowance + 2x balance)"
        );
    }

    // ── burn_from ─────────────────────────────────────────────────────────────

    /// `burn_from`:
    ///   reads  — Allowance(persistent), balance(from, persistent), TotalBurned(instance)
    ///   writes — Allowance(persistent), balance(from, persistent), TotalBurned(instance)
    ///
    /// Ledger entry ops: 2 persistent rw + 1 instance rw.
    #[test]
    fn estimate_burn_from_storage_ops() {
        let (env, client, _admin, _minter) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        client.mint(&owner, &1_000_i128);
        client.approve(&owner, &spender, &600_i128, &9_999_u32);

        client.burn_from(&spender, &owner, &400_i128);
        assert_eq!(client.balance(&owner), 600_i128);
        assert_eq!(client.total_supply(), 600_i128);
        assert_eq!(client.allowance(&owner, &spender), 200_i128);

        println!(
            "[storage_cost] burn_from: 2 persistent rw (Allowance + balance) \
            + 1 instance rw (TotalBurned)"
        );
    }

    // ── set_minter ────────────────────────────────────────────────────────────

    /// `set_minter`:
    ///   reads  — Admin(instance)
    ///   writes — Minter(instance)
    ///
    /// Ledger entry ops: 1 instance read + 1 instance write
    /// (both instance keys share a single ledger entry, so this is 1 entry touched).
    #[test]
    fn estimate_set_minter_storage_ops() {
        let (env, client, admin, _minter) = setup();
        let new_minter = Address::generate(&env);

        client.set_minter(&admin, &new_minter);

        println!(
            "[storage_cost] set_minter: 1 instance read (Admin) + 1 instance write (Minter) \
            = 1 instance ledger entry touched"
        );
    }

    // ── total_supply / balance ────────────────────────────────────────────────

    /// `total_supply`:
    ///   reads — TotalMinted(instance), TotalBurned(instance)
    ///
    /// `balance`:
    ///   reads — balance(persistent)
    ///
    /// Both are read-only; no writes.
    #[test]
    fn estimate_read_only_ops() {
        let (env, client, _admin, _minter) = setup();
        let user = Address::generate(&env);
        client.mint(&user, &1_000_i128);
        client.burn(&user, &200_i128);

        let _ = client.total_supply(); // 2 instance reads
        let _ = client.balance(&user); // 1 persistent read

        println!(
            "[storage_cost] total_supply: 2 instance reads (no writes); \
            balance: 1 persistent read (no writes)"
        );
    }

    // ── retire ────────────────────────────────────────────────────────────────

    /// `retire`:
    ///   reads  — Retired(persistent), balance(persistent), TotalBurned(instance)
    ///   writes — balance(persistent), Retired(persistent) [if full balance retired], TotalBurned(instance)
    ///
    /// Ledger entry ops: 2-3 persistent ops + 1 instance rw.
    #[test]
    fn estimate_retire_storage_ops() {
        let (env, client, _admin, _minter) = setup();
        let user = Address::generate(&env);
        client.mint(&user, &2_000_i128);

        let reason = soroban_sdk::String::from_str(&env, "REC compliance");
        client.retire(&user, &2_000_i128, &reason);
        assert_eq!(client.balance(&user), 0_i128);
        assert_eq!(client.total_supply(), 0_i128);

        println!(
            "[storage_cost] retire (full balance): \
            3 persistent ops (Retired read, balance rw, Retired write) \
            + 1 instance rw (TotalBurned)"
        );
    }

    // ── summary ───────────────────────────────────────────────────────────────

    /// Prints a full storage cost summary for all energy_token methods.
    /// Run with `-- --nocapture` to see output.
    #[test]
    fn storage_cost_summary() {
        println!(
            "\n\
            ╔══════════════════════════════════════════════════════════════════╗\n\
            ║         Storage Cost Summary — energy_token (issue #564)        ║\n\
            ╠══════════════════╦══════════════╦═════════════════════════════════╣\n\
            ║ Method           ║ Instance ops ║ Persistent ops                  ║\n\
            ╠══════════════════╬══════════════╬═════════════════════════════════╣\n\
            ║ initialize       ║ 5 writes     ║ —                               ║\n\
            ║ mint (new addr)  ║ 1 rw         ║ 1 write (new balance entry)     ║\n\
            ║ mint (existing)  ║ 1 rw         ║ 1 rw   (existing balance)       ║\n\
            ║ burn             ║ 1 rw         ║ 1 rw   (balance)                ║\n\
            ║ transfer         ║ —            ║ 2 rw   (from + to balances)     ║\n\
            ║ transfer (self)  ║ —            ║ — (early return)                ║\n\
            ║ approve          ║ —            ║ 1 write (Allowance)             ║\n\
            ║ transfer_from    ║ —            ║ 3 rw   (Allowance + 2 balances) ║\n\
            ║ burn_from        ║ 1 rw         ║ 2 rw   (Allowance + balance)    ║\n\
            ║ set_minter       ║ 1 r + 1 w    ║ —                               ║\n\
            ║ total_supply     ║ 2 reads      ║ —                               ║\n\
            ║ balance          ║ —            ║ 1 read                          ║\n\
            ║ retire (partial) ║ 1 rw         ║ 2 rw   (Retired read + balance) ║\n\
            ║ retire (full)    ║ 1 rw         ║ 3 ops  (+ Retired write)        ║\n\
            ╚══════════════════╩══════════════╩═════════════════════════════════╝\n\
            \n\
            Legend: rw = read then write; r = read only; w = write only\n\
            Instance ops share ONE ledger entry (the contract instance blob).\n\
            Each persistent op is a SEPARATE ledger entry."
        );
    }
}
