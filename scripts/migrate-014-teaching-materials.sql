-- migrate-014: Teaching Materials (เอกสารการสอน, #109, ADR 0012).
-- Idempotent — safe to run multiple times. Mirrors schema.sql.
CREATE TABLE IF NOT EXISTS teaching_materials (
  id              SERIAL PRIMARY KEY,
  course_code     TEXT    NOT NULL,
  course_year     INTEGER NOT NULL,
  course_semester INTEGER NOT NULL,
  week_no         INTEGER NOT NULL CHECK (week_no BETWEEN 1 AND 20),
  kind            TEXT    NOT NULL CHECK (kind IN ('slides', 'handout', 'lab')),
  body            TEXT    NOT NULL DEFAULT '',
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (course_code, course_year, course_semester, week_no, kind),
  FOREIGN KEY (course_code, course_year, course_semester)
    REFERENCES courses(code, year, semester) ON DELETE CASCADE
);
