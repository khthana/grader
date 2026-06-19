-- Migration 001: Replace surrogate course id with natural composite PK (code, year, semester)
-- Apply with: psql $DATABASE_URL -f scripts/migrate-001-natural-keys.sql
-- Idempotent: safe to run multiple times (uses IF EXISTS / DO NOTHING).

BEGIN;

-- ── Step 1: Add year/semester to courses ─────────────────────────────────────

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS year     INTEGER NOT NULL DEFAULT 2569,
  ADD COLUMN IF NOT EXISTS semester INTEGER NOT NULL DEFAULT 1;

-- ── Step 2: Add composite key columns to child tables ────────────────────────

ALTER TABLE course_instructors
  ADD COLUMN IF NOT EXISTS course_code     TEXT,
  ADD COLUMN IF NOT EXISTS course_year     INTEGER,
  ADD COLUMN IF NOT EXISTS course_semester INTEGER;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS course_code     TEXT,
  ADD COLUMN IF NOT EXISTS course_year     INTEGER,
  ADD COLUMN IF NOT EXISTS course_semester INTEGER;

ALTER TABLE weeks
  ADD COLUMN IF NOT EXISTS course_code     TEXT,
  ADD COLUMN IF NOT EXISTS course_year     INTEGER,
  ADD COLUMN IF NOT EXISTS course_semester INTEGER;

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS course_code     TEXT,
  ADD COLUMN IF NOT EXISTS course_year     INTEGER,
  ADD COLUMN IF NOT EXISTS course_semester INTEGER,
  ADD COLUMN IF NOT EXISTS problem_no      INTEGER;

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS course_code     TEXT,
  ADD COLUMN IF NOT EXISTS course_year     INTEGER,
  ADD COLUMN IF NOT EXISTS course_semester INTEGER;

-- ── Step 3: Back-fill composite key columns from the courses table ────────────

UPDATE course_instructors ci
SET course_code = c.code, course_year = c.year, course_semester = c.semester
FROM courses c WHERE c.id = ci.course_id
  AND ci.course_code IS NULL;

UPDATE enrollments e
SET course_code = c.code, course_year = c.year, course_semester = c.semester
FROM courses c WHERE c.id = e.course_id
  AND e.course_code IS NULL;

UPDATE weeks w
SET course_code = c.code, course_year = c.year, course_semester = c.semester
FROM courses c WHERE c.id = w.course_id
  AND w.course_code IS NULL;

UPDATE problems p
SET course_code = c.code, course_year = c.year, course_semester = c.semester
FROM courses c WHERE c.id = p.course_id
  AND p.course_code IS NULL;

UPDATE submissions s
SET course_code = c.code, course_year = c.year, course_semester = c.semester
FROM courses c WHERE c.id = s.course_id
  AND s.course_code IS NULL;

-- ── Step 4: Assign problem_no (per-week sequential) ──────────────────────────

UPDATE problems p SET problem_no = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY week_id ORDER BY id) AS rn
  FROM problems
) sub
WHERE p.id = sub.id AND p.problem_no IS NULL;

-- ── Step 5: Set NOT NULL on back-filled columns ───────────────────────────────

ALTER TABLE course_instructors
  ALTER COLUMN course_code     SET NOT NULL,
  ALTER COLUMN course_year     SET NOT NULL,
  ALTER COLUMN course_semester SET NOT NULL;

ALTER TABLE enrollments
  ALTER COLUMN course_code     SET NOT NULL,
  ALTER COLUMN course_year     SET NOT NULL,
  ALTER COLUMN course_semester SET NOT NULL;

ALTER TABLE weeks
  ALTER COLUMN course_code     SET NOT NULL,
  ALTER COLUMN course_year     SET NOT NULL,
  ALTER COLUMN course_semester SET NOT NULL;

ALTER TABLE problems
  ALTER COLUMN course_code     SET NOT NULL,
  ALTER COLUMN course_year     SET NOT NULL,
  ALTER COLUMN course_semester SET NOT NULL,
  ALTER COLUMN problem_no      SET NOT NULL;

ALTER TABLE submissions
  ALTER COLUMN course_code     SET NOT NULL,
  ALTER COLUMN course_year     SET NOT NULL,
  ALTER COLUMN course_semester SET NOT NULL;

-- ── Step 6: Drop old FK constraints ──────────────────────────────────────────

ALTER TABLE course_instructors DROP CONSTRAINT IF EXISTS course_instructors_course_id_fkey;
ALTER TABLE enrollments         DROP CONSTRAINT IF EXISTS enrollments_course_id_fkey;
ALTER TABLE weeks               DROP CONSTRAINT IF EXISTS weeks_course_id_fkey;
ALTER TABLE problems            DROP CONSTRAINT IF EXISTS problems_course_id_fkey;
ALTER TABLE submissions         DROP CONSTRAINT IF EXISTS submissions_course_id_fkey;

-- ── Step 7: Drop old surrogate id from enrollments ────────────────────────────

ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_pkey;
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_course_id_user_id_key;
ALTER TABLE enrollments DROP COLUMN IF EXISTS id;
ALTER TABLE enrollments DROP COLUMN IF EXISTS course_id;

-- ── Step 8: Drop old course_id columns from remaining tables ─────────────────

ALTER TABLE course_instructors DROP COLUMN IF EXISTS course_id;
ALTER TABLE weeks               DROP COLUMN IF EXISTS course_id;
ALTER TABLE problems            DROP COLUMN IF EXISTS course_id;
ALTER TABLE submissions         DROP COLUMN IF EXISTS course_id;

-- ── Step 9: Upgrade courses PK ───────────────────────────────────────────────

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_pkey;
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_code_key;
ALTER TABLE courses DROP COLUMN IF EXISTS id;
ALTER TABLE courses ADD CONSTRAINT courses_pkey PRIMARY KEY (code, year, semester);
ALTER TABLE courses ADD CONSTRAINT semester_check CHECK (semester IN (1, 2, 3));

-- ── Step 10: Upgrade course_instructors PK ───────────────────────────────────

ALTER TABLE course_instructors DROP CONSTRAINT IF EXISTS course_instructors_pkey;
ALTER TABLE course_instructors ADD PRIMARY KEY (course_code, course_year, course_semester, user_id);

-- ── Step 11: Add enrollments PK ──────────────────────────────────────────────

ALTER TABLE enrollments ADD PRIMARY KEY (course_code, course_year, course_semester, user_id);

-- ── Step 12: Add UNIQUE constraints ──────────────────────────────────────────

ALTER TABLE weeks DROP CONSTRAINT IF EXISTS weeks_course_id_week_no_key;
ALTER TABLE weeks ADD CONSTRAINT weeks_course_natural_key
  UNIQUE (course_code, course_year, course_semester, week_no);

ALTER TABLE problems ADD CONSTRAINT problems_week_no_unique
  UNIQUE (week_id, problem_no);

-- ── Step 13: Add composite FK constraints ────────────────────────────────────

ALTER TABLE course_instructors ADD CONSTRAINT course_instructors_course_fkey
  FOREIGN KEY (course_code, course_year, course_semester)
  REFERENCES courses(code, year, semester) ON DELETE CASCADE;

ALTER TABLE enrollments ADD CONSTRAINT enrollments_course_fkey
  FOREIGN KEY (course_code, course_year, course_semester)
  REFERENCES courses(code, year, semester) ON DELETE CASCADE;

ALTER TABLE weeks ADD CONSTRAINT weeks_course_fkey
  FOREIGN KEY (course_code, course_year, course_semester)
  REFERENCES courses(code, year, semester) ON DELETE CASCADE;

ALTER TABLE problems ADD CONSTRAINT problems_course_fkey
  FOREIGN KEY (course_code, course_year, course_semester)
  REFERENCES courses(code, year, semester) ON DELETE CASCADE;

ALTER TABLE submissions ADD CONSTRAINT submissions_course_fkey
  FOREIGN KEY (course_code, course_year, course_semester)
  REFERENCES courses(code, year, semester) ON DELETE CASCADE;

COMMIT;
