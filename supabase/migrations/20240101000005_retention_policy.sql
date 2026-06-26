-- Migration 005: retention policy
-- Adds archival columns to readings and table-level retention comments.
-- See docs/DATA_CLASSIFICATION.md for the full policy.

comment on table readings is
  'Energy meter readings. Retention: 7 years from timestamp (regulatory).';

comment on table certificates is
  'Minted energy certificates. Retention: 10 years from issued_at (compliance).';

alter table readings
  add column archived    boolean     not null default false,
  add column archived_at timestamptz;

create index on readings (archived);
