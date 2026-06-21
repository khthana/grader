-- Migration 003: Add reference_solution column to problems table
-- Apply with: psql $DATABASE_URL -f scripts/migrate-003-problem-reference-solution.sql
-- Idempotent: safe to run multiple times (IF NOT EXISTS).

BEGIN;

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS reference_solution TEXT NOT NULL DEFAULT '';

COMMIT;
