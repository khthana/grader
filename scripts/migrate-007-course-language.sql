-- C language support — Slice 2 (#63): per-course language binding.
-- Adds the column that records a course's language; problems inherit it.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'python';
