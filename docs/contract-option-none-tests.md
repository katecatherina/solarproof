# Contract unit tests for Option/None cases

This document provides guidance and example unit tests for handling `Option`/`None` cases in the smart contract Rust code.

## Rationale

- Edge cases involving `None` or absent values are a common source of bugs in contract logic. Tests should cover these cases explicitly.

## Example (Rust unit test)

Example test snippet for an `Option`/`None` case:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_error_for_missing_value() {
        let maybe_value: Option<u64> = None;
        assert!(maybe_value.is_none());
        // call into contract logic that expects value and assert it handles None correctly
    }
}
```

## Where to place tests

- Unit tests: inside the corresponding crate under `src/` with `#[cfg(test)]`.
- Integration tests: use the `tests/` directory in the crate root for broader scenarios.

## Running tests

- From the crate directory: `cargo test --package <crate-name>`
