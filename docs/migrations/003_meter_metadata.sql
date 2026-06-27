-- Migration 003: add signed meter metadata columns to readings
alter table readings
  add column if not exists metadata jsonb,
  add column if not exists metadata_hash text,          -- SHA-256 hex of canonical metadata JSON
  add column if not exists metadata_signature_hex text; -- Ed25519 sig over metadata_hash (128 hex chars)

create index if not exists readings_metadata_hash_idx on readings(metadata_hash);
