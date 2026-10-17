-- Syllabus (ประมวลรายวิชา) for each Course offering (#97 / #99).
-- Idempotent; mirrors schema.sql. All three tables land here so the Teaching
-- Plan (#100) and Assessment Components (#101) need no further migration.
-- None of them references Weeks: the Teaching Plan is not the Week.
CREATE TABLE IF NOT EXISTS course_syllabi (
  course_code     TEXT    NOT NULL,
  course_year     INTEGER NOT NULL,
  course_semester INTEGER NOT NULL,
  credits         TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  objectives      TEXT NOT NULL DEFAULT '',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (course_code, course_year, course_semester),
  FOREIGN KEY (course_code, course_year, course_semester)
    REFERENCES courses(code, year, semester) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS syllabus_plan_entries (
  id              SERIAL PRIMARY KEY,
  course_code     TEXT    NOT NULL,
  course_year     INTEGER NOT NULL,
  course_semester INTEGER NOT NULL,
  week_no         INTEGER NOT NULL CHECK (week_no BETWEEN 1 AND 20),
  topic           TEXT NOT NULL,
  detail          TEXT NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (course_code, course_year, course_semester)
    REFERENCES courses(code, year, semester) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS syllabus_assessments (
  id              SERIAL PRIMARY KEY,
  course_code     TEXT    NOT NULL,
  course_year     INTEGER NOT NULL,
  course_semester INTEGER NOT NULL,
  name            TEXT NOT NULL,
  weight          NUMERIC(5,2) NOT NULL CHECK (weight >= 0 AND weight <= 100),
  note            TEXT NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (course_code, course_year, course_semester)
    REFERENCES courses(code, year, semester) ON DELETE CASCADE
);
