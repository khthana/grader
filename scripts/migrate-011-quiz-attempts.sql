-- Quiz Attempts for Pre/Post-test Quizzes (#92, ADR 0011).
-- Idempotent; mirrors schema.sql.
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id           SERIAL PRIMARY KEY,
  quiz_id      INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  round        TEXT NOT NULL CHECK (round IN ('pre', 'post')),
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers      JSONB NOT NULL DEFAULT '{}',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  UNIQUE (quiz_id, round, user_id)
);
