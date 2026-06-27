//! Overflow/underflow test coverage for energy_token arithmetic (#559).
//!
//! Tests every arithmetic path that involves i128 addition or subtraction:
//! - mint(): balance overflow, total_minted overflow
//! - transfer(): recipient balance overflow, sender underflow
//! - burn(): underflow (burn more than balance)
//! - burn_from(): underflow, insufficient allowance
//! - transfer_from(): recipient balance overflow
//! - approve(): negative amount rejected
//! - zero-amount rejections (positive-only guard)

#![cfg(test)]

use energy_token::{EnergyToken, EnergyTokenClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

fn setup() -> (Env, EnergyTokenClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(EnergyToken, ());
    let client = EnergyTokenClient::new(&env, &id);
    let admin = Address::generate(&env);
    let minter = Address::generate(&env);
    client.initialize(&admin, &minter);
    (env, client)
}

// ── mint: balance overflow ────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "overflow: balance")]
fn mint_overflows_recipient_balance() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    // Fill balance to i128::MAX
    client.mint(&user, &i128::MAX);
    // Any positive mint must now overflow
    client.mint(&user, &1_i128);
}

// ── mint: total_minted overflow ───────────────────────────────────────────────

#[test]
#[should_panic(expected = "overflow: total_minted")]
fn mint_overflows_total_minted() {
    let (env, client) = setup();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    // Two recipients — balance per address is fine, but total_minted overflows
    client.mint(&a, &i128::MAX);
    client.mint(&b, &1_i128);
}

// ── mint: zero and negative amount rejected ───────────────────────────────────

#[test]
#[should_panic(expected = "amount must be positive")]
fn mint_zero_amount_rejected() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    client.mint(&user, &0_i128);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn mint_negative_amount_rejected() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    client.mint(&user, &-1_i128);
}

// ── burn: underflow (burn more than balance) ──────────────────────────────────

#[test]
#[should_panic(expected = "insufficient balance")]
fn burn_underflows_when_amount_exceeds_balance() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    client.mint(&user, &100_i128);
    client.burn(&user, &101_i128);
}

#[test]
#[should_panic(expected = "insufficient balance")]
fn burn_underflows_on_zero_balance() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    // No mint — balance is 0
    client.burn(&user, &1_i128);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn burn_zero_amount_rejected() {
    let (env, client) = setup();
    let user = Address::generate(&env);
    client.mint(&user, &100_i128);
    client.burn(&user, &0_i128);
}

// ── transfer: sender underflow ────────────────────────────────────────────────

#[test]
#[should_panic(expected = "insufficient balance")]
fn transfer_underflows_sender() {
    let (env, client) = setup();
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    client.mint(&from, &50_i128);
    client.transfer(&from, &to, &51_i128);
}

// ── transfer: recipient balance overflow ──────────────────────────────────────

#[test]
#[should_panic(expected = "overflow: recipient balance")]
fn transfer_overflows_recipient_balance() {
    let (env, client) = setup();
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    // Give `to` a balance near i128::MAX
    client.mint(&to, &(i128::MAX - 10));
    // Give `from` enough to trigger overflow on recipient
    client.mint(&from, &20_i128);
    client.transfer(&from, &to, &20_i128);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn transfer_zero_amount_rejected() {
    let (env, client) = setup();
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    client.mint(&from, &100_i128);
    client.transfer(&from, &to, &0_i128);
}

// ── burn_from: underflow ──────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "insufficient balance")]
fn burn_from_underflows_when_balance_exhausted() {
    let (env, client) = setup();
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    client.mint(&owner, &10_i128);
    client.approve(&owner, &spender, &50_i128);
    client.burn_from(&spender, &owner, &11_i128);
}

#[test]
#[should_panic(expected = "insufficient allowance")]
fn burn_from_underflows_allowance() {
    let (env, client) = setup();
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    client.mint(&owner, &100_i128);
    client.approve(&owner, &spender, &5_i128);
    client.burn_from(&spender, &owner, &6_i128);
}

// ── approve: negative amount rejected ────────────────────────────────────────

#[test]
#[should_panic(expected = "amount must be non-negative")]
fn approve_negative_amount_rejected() {
    let (env, client) = setup();
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    client.approve(&owner, &spender, &-1_i128);
}

// ── transfer_from: recipient overflow ────────────────────────────────────────

#[test]
#[should_panic(expected = "overflow: recipient balance")]
fn transfer_from_overflows_recipient() {
    let (env, client) = setup();
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let to = Address::generate(&env);
    client.mint(&owner, &20_i128);
    client.mint(&to, &(i128::MAX - 10));
    client.approve(&owner, &spender, &20_i128);
    client.transfer_from(&spender, &owner, &to, &20_i128);
}
