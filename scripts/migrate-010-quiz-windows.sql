-- Round Windows for Pre/Post-test Quizzes (#91, ADR 0011).
-- Idempotent; mirrors schema.sql.
CREATE TABLE IF NOT EXISTS quiz_windows (
  quiz_id    INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  round      TEXT NOT NULL CHECK (round IN ('pre', 'post')),
  group_key  TEXT NOT NULL,
  opens_at   TIMESTAMPTZ,
  closes_at  TIMESTAMPTZ,
  PRIMARY KEY (quiz_id, round, group_key)
);
