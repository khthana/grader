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
  nickname      TEXT,
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
  detail       TEXT,                   -- what changed, when the action alone doesn't say (#111)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The four roles are fixed for this product.
INSERT INTO roles (name) VALUES ('Admin'), ('Instructor'), ('TA'), ('Student')
ON CONFLICT (name) DO NOTHING;

-- Course domain. Natural composite PK: (code, year, semester) uniquely identifies
-- a course offering. year is Thai Buddhist year (พ.ศ., e.g. 2567).
CREATE TABLE IF NOT EXISTS courses (
  code       TEXT    NOT NULL,
  year       INTEGER NOT NULL,          -- Thai Buddhist year, e.g. 2567
  semester   INTEGER NOT NULL,          -- 1, 2, or 3
  name_th    TEXT    NOT NULL,
  name_en    TEXT    NOT NULL,
  program    TEXT,                       -- default program for new enrollments
  language   TEXT    NOT NULL DEFAULT 'python',  -- problems inherit this (#63)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (code, year, semester),
  CHECK (semester IN (1, 2, 3))
);

-- Which Users (Instructor/TA, by their global role) may manage a Course.
CREATE TABLE IF NOT EXISTS course_instructors (
  course_code     TEXT    NOT NULL,
  course_year     INTEGER NOT NULL,
  course_semester INTEGER NOT NULL,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (course_code, course_year, course_semester, user_id),
  FOREIGN KEY (course_code, course_year, course_semester)
    REFERENCES courses(code, year, semester) ON DELETE CASCADE
);

-- A Student's membership in a Course's roster. Composite PK eliminates the
-- surrogate id. 'group' is a SQL reserved word, so the column is study_group.
CREATE TABLE IF NOT EXISTS enrollments (
  course_code     TEXT    NOT NULL,
  course_year     INTEGER NOT NULL,
  course_semester INTEGER NOT NULL,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  study_group     TEXT,
  program         TEXT,
  year            TEXT,                  -- student cohort year (distinct from course_year)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (course_code, course_year, course_semester, user_id),
  FOREIGN KEY (course_code, course_year, course_semester)
    REFERENCES courses(code, year, semester) ON DELETE CASCADE
);

-- Problem domain. Problems are course-scoped, organised by Week.
-- New courses seed DEFAULT_WEEKS (6) weeks; Instructors can append up to MAX_WEEKS (16).
-- weeks keeps a surrogate id to anchor the problems FK without 5-level cascades.
CREATE TABLE IF NOT EXISTS weeks (
  id              SERIAL PRIMARY KEY,
  course_code     TEXT    NOT NULL,
  course_year     INTEGER NOT NULL,
  course_semester INTEGER NOT NULL,
  week_no         INTEGER NOT NULL,
  topic           TEXT NOT NULL DEFAULT '',
  is_released     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_code, course_year, course_semester, week_no),
  FOREIGN KEY (course_code, course_year, course_semester)
    REFERENCES courses(code, year, semester) ON DELETE CASCADE
);

-- problems keeps a surrogate id as FK anchor for test_cases and submissions.
-- problem_no is a per-week sequential number used in the public URL.
CREATE TABLE IF NOT EXISTS problems (
  id              SERIAL PRIMARY KEY,
  course_code     TEXT    NOT NULL,
  course_year     INTEGER NOT NULL,
  course_semester INTEGER NOT NULL,
  week_id         INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  problem_no      INTEGER NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  input_spec      TEXT NOT NULL DEFAULT '',
  output_spec     TEXT NOT NULL DEFAULT '',
  score           INTEGER NOT NULL DEFAULT 10,
  due_at          TIMESTAMPTZ,
  close_at        TIMESTAMPTZ,
  language            TEXT NOT NULL DEFAULT 'python',
  reference_solution  TEXT NOT NULL DEFAULT '',
  problem_type        TEXT NOT NULL DEFAULT 'io',
  function_name       TEXT NOT NULL DEFAULT '',
  starter_code        TEXT NOT NULL DEFAULT '',
  unit_test_code      TEXT NOT NULL DEFAULT '',
  blacklist           TEXT[] NOT NULL DEFAULT '{}',
  whitelist           TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_id, problem_no),
  FOREIGN KEY (course_code, course_year, course_semester)
    REFERENCES courses(code, year, semester) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS test_cases (
  id              SERIAL PRIMARY KEY,
  problem_id      INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  input           TEXT NOT NULL DEFAULT '',
  expected_output TEXT NOT NULL DEFAULT '',
  is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
  score           INTEGER NOT NULL DEFAULT 10,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

-- course_code/year/semester stored for fast per-course queries without joining
-- up through problems → weeks → courses.
CREATE TABLE IF NOT EXISTS submissions (
  id              SERIAL PRIMARY KEY,
  problem_id      INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_code     TEXT    NOT NULL,
  course_year     INTEGER NOT NULL,
  course_semester INTEGER NOT NULL,
  code            TEXT NOT NULL,
  language        TEXT NOT NULL DEFAULT 'python',
  points_earned   NUMERIC,
  points_max      NUMERIC,
  is_late         BOOLEAN NOT NULL DEFAULT FALSE,
  results         JSONB,
  manual_score    NUMERIC,
  reviewed_by     INTEGER REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (course_code, course_year, course_semester)
    REFERENCES courses(code, year, semester) ON DELETE CASCADE
);

-- Pre/Post-test Quizzes (ADR 0011). A Quiz is its own domain — not a Problem:
-- multiple-choice questions, no code runner. week_id is an optional label;
-- the route checks it belongs to the same course (cf. #88).
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

-- choices: [{ "letter": "A", "text": "..." }] in authored order.
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

-- Round Window (#91, ADR 0011): when one Quiz Round accepts answers for one
-- Group. group_key '' = students with no Group (ไม่ระบุกลุ่ม). Half-open
-- [opens_at, closes_at); a null opens_at = not opened yet, null closes_at = no close.
CREATE TABLE IF NOT EXISTS quiz_windows (
  quiz_id    INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  round      TEXT NOT NULL CHECK (round IN ('pre', 'post')),
  group_key  TEXT NOT NULL,
  opens_at   TIMESTAMPTZ,
  closes_at  TIMESTAMPTZ,
  PRIMARY KEY (quiz_id, round, group_key)
);

-- Quiz Attempt (#92, ADR 0011): one Student's answers to one Quiz Round.
-- answers: { "<questionId>": "<letter>" | "dont-know" }. Submitted when
-- submitted_at is set OR the Student's Group window has closed (derived on read).
-- A Quiz with any attempt is locked (questions can't be re-imported).
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

-- Syllabus (ประมวลรายวิชา) — #97 / #99, scripts/migrate-012-syllabus.sql.
CREATE TABLE IF NOT EXISTS course_syllabi (
  course_code     TEXT    NOT NULL,
  course_year     INTEGER NOT NULL,
  course_semester INTEGER NOT NULL,
  credits         TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  objectives      TEXT NOT NULL DEFAULT '',
  resources       TEXT NOT NULL DEFAULT '',   -- Learning Resources (#107)
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

-- Teaching Materials (เอกสารการสอน, #109, ADR 0012): one Material Kind for one
-- Teaching Plan week number. Not linked to weeks or syllabus_plan_entries —
-- the heading is joined by week number in code; a week the plan lacks makes
-- the Material Unplanned. `id` anchors Phase 2 attachments and never appears
-- in a URL (week + kind does).
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

-- Attachments (ไฟล์แนบ) of a Teaching Material (#114, ADR 0013). The bytes live
-- on disk under ATTACHMENTS_DIR, named by sha256; a row is deleted with its
-- Material, and unreferenced files are swept.
CREATE TABLE IF NOT EXISTS material_attachments (
  id            SERIAL PRIMARY KEY,
  material_id   INTEGER NOT NULL REFERENCES teaching_materials(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  content_type  TEXT    NOT NULL,
  size_bytes    INTEGER NOT NULL,
  sha256        TEXT    NOT NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (material_id, name)
);
CREATE INDEX IF NOT EXISTS material_attachments_sha256 ON material_attachments (sha256);
