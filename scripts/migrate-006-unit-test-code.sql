-- Unit Test Mode v2 (#55): single pytest-style test-code block replaces args/expected.
-- Adds the column that stores the instructor's unit test code block.
ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS unit_test_code TEXT NOT NULL DEFAULT '';
