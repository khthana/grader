-- migrate-016: Attachments of Teaching Materials (ไฟล์แนบ, #114, ADR 0013).
-- Idempotent — safe to run multiple times. Mirrors schema.sql.
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
