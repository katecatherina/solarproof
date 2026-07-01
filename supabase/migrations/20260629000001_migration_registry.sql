-- Migration: Migration registry and schema drift detection
-- Closes #548
--
-- Purpose: Provide full traceability for every applied database migration and
-- a mechanism to detect schema drift between environments or after manual
-- schema changes.  Two facilities are added:
--
--   1. migration_registry   – a table that records each migration file that has
--                             been applied, including its MD5 checksum, who ran
--                             it, and when.
--
--   2. record_migration()   – a helper function that upserts a row into the
--                             registry.  Call it at the end of each migration
--                             file (or from the CI drift-detection script after
--                             applying a migration).
--
--   3. detect_schema_drift() – returns the full column inventory of every table
--                              in the public schema.  Save the output as a
--                              baseline; re-run it later and diff to find drift.

-- ---------------------------------------------------------------------------
-- 1. migration_registry table
-- ---------------------------------------------------------------------------

create table if not exists migration_registry (
  -- Unique identifier: the migration file name without path, e.g.
  -- '20260629000001_migration_registry.sql'
  migration_name  text        primary key,

  -- UTC timestamp of when this migration was applied.
  applied_at      timestamptz not null default now(),

  -- MD5 hex digest of the SQL file content at the time it was applied.
  -- Used by check-migration-drift.sh to detect post-apply file tampering.
  checksum        text        not null,

  -- The Postgres role or application identity that applied the migration.
  -- Defaults to the current database user.
  applied_by      text        not null default current_user,

  -- Free-form notes – e.g. ticket reference, deployment tag.
  notes           text
);

comment on table  migration_registry                  is 'Tracks every applied Supabase migration with its file checksum for drift detection (#548).';
comment on column migration_registry.migration_name  is 'Migration file name (without path), used as the unique key.';
comment on column migration_registry.applied_at      is 'UTC timestamp of when the migration was applied.';
comment on column migration_registry.checksum        is 'MD5 hex digest of the SQL file at apply-time; used to detect post-apply tampering.';
comment on column migration_registry.applied_by      is 'Database role or app identity that ran the migration.';
comment on column migration_registry.notes           is 'Optional free-form notes, e.g. ticket reference or deployment tag.';

-- ---------------------------------------------------------------------------
-- 2. record_migration() – upsert helper
-- ---------------------------------------------------------------------------
-- Usage:
--   SELECT record_migration(
--     'my_migration.sql',
--     'md5-hex-digest-here',
--     'ci-runner',
--     'Deployed in release v1.2.3'
--   );
--
-- On conflict (same migration_name) it updates applied_at and checksum so
-- that re-runs are idempotent.

create or replace function record_migration(
  p_migration_name  text,
  p_checksum        text,
  p_applied_by      text    default current_user,
  p_notes           text    default null
)
returns void
language plpgsql
security definer
as $$
begin
  insert into migration_registry (migration_name, applied_at, checksum, applied_by, notes)
  values (p_migration_name, now(), p_checksum, p_applied_by, p_notes)
  on conflict (migration_name) do update
    set applied_at = excluded.applied_at,
        checksum   = excluded.checksum,
        applied_by = excluded.applied_by,
        notes      = excluded.notes;
end;
$$;

comment on function record_migration(text, text, text, text) is
  'Upserts a migration record into migration_registry. Safe to call multiple times (idempotent on migration_name).';

-- ---------------------------------------------------------------------------
-- 3. detect_schema_drift() – public-schema column inventory
-- ---------------------------------------------------------------------------
-- Returns one row per (table, column) in the public schema, ordered for
-- stable diff output.  Capture the output with:
--
--   psql "$DATABASE_URL" -c "\copy (SELECT * FROM detect_schema_drift()) TO 'baseline.csv' CSV HEADER"
--
-- Re-run after any change and diff against the baseline to find drift.

create or replace function detect_schema_drift()
returns table (
  table_name   text,
  column_name  text,
  data_type    text,
  is_nullable  text
)
language sql
security definer
stable
as $$
  select
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text
  from information_schema.columns c
  where c.table_schema = 'public'
  order by c.table_name, c.ordinal_position;
$$;

comment on function detect_schema_drift() is
  'Returns the full column inventory of every public-schema table. '
  'Capture as a baseline and re-run to detect schema drift between environments or after manual changes.';

-- ---------------------------------------------------------------------------
-- Register this migration itself
-- ---------------------------------------------------------------------------
-- The checksum here is a placeholder ('bootstrap') because the file''s own
-- MD5 cannot be known until after it is written.  The CI script
-- check-migration-drift.sh will overwrite this with the real checksum on
-- first run.
select record_migration(
  '20260629000001_migration_registry.sql',
  'bootstrap',
  current_user,
  'Initial migration registry setup – closes #548'
);
