-- migrate-015: an optional detail on activity log entries (#111) — e.g. which
-- Teaching Material was moved or deleted. Idempotent. Mirrors schema.sql.
ALTER TABLE user_logs ADD COLUMN IF NOT EXISTS detail TEXT;
