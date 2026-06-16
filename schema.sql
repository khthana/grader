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
