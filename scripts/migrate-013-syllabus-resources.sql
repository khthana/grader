-- migrate-013: Learning Resources (แหล่งเรียนรู้) on the Syllabus (#107).
-- Idempotent — safe to run multiple times. Mirrors schema.sql.
ALTER TABLE course_syllabi ADD COLUMN IF NOT EXISTS resources TEXT NOT NULL DEFAULT '';
