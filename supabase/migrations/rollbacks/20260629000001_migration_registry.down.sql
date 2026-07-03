-- Rollback: Migration registry and schema drift detection
-- Reverses: 20260629000001_migration_registry.sql

-- Drop in reverse dependency order: functions first, then the table they
-- reference so that the table drop does not fail due to dependent objects.

drop function if exists detect_schema_drift();
drop function if exists record_migration(text, text, text, text);
drop table   if exists migration_registry;
