-- CE-Grader schema — auth walking skeleton (issue #1)
-- Raw SQL, applied via `pg`. Single users table; roles many-to-many.

CREATE TABLE IF NOT EXISTS roles (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE          -- 'Admin' | 'Instructor' | 'TA' | 'Student'
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,                -- bcrypt; nullable for Google-only accounts
  name          TEXT NOT NULL,       -- display name (derived from structured fields when present)
  -- structured name fields (Thai + English) — nullable here, populated by User Management (#4)
  title_th      TEXT,
  first_name_th TEXT,
  last_name_th  TEXT,
  title_en      TEXT,
  first_name_en TEXT,
  last_name_en  TEXT,
  phone         TEXT,
  id_code       TEXT,                -- รหัสนักศึกษา / staff id, optional
  picture       TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Activity audit log. actor/target emails are snapshots so entries survive
-- user deletion; no FK so a delete log can reference a just-removed user.
CREATE TABLE IF NOT EXISTS user_logs (
  id           SERIAL PRIMARY KEY,
  actor_id     INTEGER,
  actor_email  TEXT,
  action       TEXT NOT NULL,          -- user.create | user.update | user.delete | user.roles | login
  target_id    INTEGER,
  target_email TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The four roles are fixed for this product.
INSERT INTO roles (name) VALUES ('Admin'), ('Instructor'), ('TA'), ('Student')
ON CONFLICT (name) DO NOTHING;

-- Course domain (issue #9 / ADR 0001). A Course owns a roster of enrolled
-- Students; course-local fields (group/program/year) live on the Enrollment.
CREATE TABLE IF NOT EXISTS courses (
  id         SERIAL PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  name_th    TEXT NOT NULL,
  name_en    TEXT NOT NULL,
  program    TEXT,                       -- default program for new enrollments
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which Users (Instructor/TA, by their global role) may manage a Course.
CREATE TABLE IF NOT EXISTS course_instructors (
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, user_id)
);

-- A Student's membership in a Course's roster. 'group' is a SQL reserved word,
-- so the column is named study_group (app-level field stays "group").
CREATE TABLE IF NOT EXISTS enrollments (
  id          SERIAL PRIMARY KEY,
  course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  study_group TEXT,
  program     TEXT,
  year        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);

-- Problem domain (issue #17). Problems are course-scoped, organised by Week.
-- New courses seed DEFAULT_WEEKS (6) weeks with empty topics; Instructors can
-- append weeks up to MAX_WEEKS (16) or remove the last empty one, and edit
-- topics. Week count is app-enforced (see src/lib/weeks/repository.ts).
CREATE TABLE IF NOT EXISTS weeks (
  id         SERIAL PRIMARY KEY,
  course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  week_no    INTEGER NOT NULL,
  topic      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, week_no)
);

CREATE TABLE IF NOT EXISTS problems (
  id          SERIAL PRIMARY KEY,
  course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  week_id     INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  input_spec  TEXT NOT NULL DEFAULT '',
  output_spec TEXT NOT NULL DEFAULT '',
  due_at      TIMESTAMPTZ,
  close_at    TIMESTAMPTZ,
  language    TEXT NOT NULL DEFAULT 'python',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_cases (
  id              SERIAL PRIMARY KEY,
  problem_id      INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  input           TEXT NOT NULL DEFAULT '',
  expected_output TEXT NOT NULL DEFAULT '',
  is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
  score           NUMERIC NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

-- 'group' is reserved in SQL; course_id stored for fast per-course queries.
CREATE TABLE IF NOT EXISTS submissions (
  id            SERIAL PRIMARY KEY,
  problem_id    INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id     INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  language      TEXT NOT NULL DEFAULT 'python',
  points_earned NUMERIC,
  points_max    NUMERIC,
  is_late       BOOLEAN NOT NULL DEFAULT FALSE,
  results       JSONB,
  manual_score  NUMERIC,
  reviewed_by   INTEGER REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
