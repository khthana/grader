-- migrate-004: add nickname column to users table
-- Idempotent — safe to run multiple times.
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT;
