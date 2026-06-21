-- Migration 002: Add is_released flag to weeks table (Week Release Toggle)
-- Apply with: psql $DATABASE_URL -f scripts/migrate-002-week-is-released.sql
-- Idempotent: safe to run multiple times (IF NOT EXISTS).

BEGIN;

ALTER TABLE weeks
  ADD COLUMN IF NOT EXISTS is_released BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
