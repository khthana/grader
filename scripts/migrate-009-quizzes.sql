-- Pre/Post-test Quizzes (#90, ADR 0011): Quiz + Quiz Question tables.
-- Idempotent; mirrors schema.sql.
CREATE TABLE IF NOT EXISTS quizzes (
  id                SERIAL PRIMARY KEY,
  course_code       TEXT    NOT NULL,
  course_year       INTEGER NOT NULL,
  course_semester   INTEGER NOT NULL,
  week_id           INTEGER REFERENCES weeks(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  dont_know_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (course_code, course_year, course_semester)
    REFERENCES courses(code, year, semester) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id             SERIAL PRIMARY KEY,
  quiz_id        INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  sort_order     INTEGER NOT NULL,
  topic          TEXT NOT NULL DEFAULT '',
  prompt         TEXT NOT NULL,
  code           TEXT,
  choices        JSONB NOT NULL,
  correct_letter TEXT NOT NULL,
  feedback       TEXT NOT NULL DEFAULT ''
);
