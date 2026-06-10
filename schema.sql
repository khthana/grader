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
