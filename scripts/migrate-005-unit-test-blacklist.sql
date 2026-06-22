-- Migration 005: Unit Test Mode & Code Policy columns on problems; per-test-case score on test_cases
ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS problem_type  TEXT    NOT NULL DEFAULT 'io',
  ADD COLUMN IF NOT EXISTS function_name TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS starter_code  TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS blacklist     TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS whitelist     TEXT[]  NOT NULL DEFAULT '{}';

ALTER TABLE test_cases
  ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 10;
