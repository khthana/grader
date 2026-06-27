# 8. Containerize the full stack with Docker Compose

Date: 2026-06-27

## Status

Accepted

## Context

CE-Grader needs three runtime dependencies that previously had to be wired up by
hand on each machine: a PostgreSQL database, a [Piston](https://github.com/engineer-man/piston)
code-execution engine **with a Python runtime installed into it**, and the Next.js
app itself. The original README setup ran the app on the host (`npm run dev`) and
offered a single `docker run` for Postgres only — Piston had to be started and have
its Python package installed separately, and a new machine meant repeating all of it.

This ADR records a setup that was **introduced on another machine and arrived via a
pull** (commits `5976d7d`…`fe9bca3`, `feat(docker)` / `fix(docker)`); the rationale
below is reverse-engineered from `docker-compose.yml` + `Dockerfile` as they stand,
not designed from scratch here. It is documented now because the decisions embodied
in those files are non-obvious and were re-derived once already during a fresh setup.

## Decision

The whole stack runs under one `docker compose up -d`. Five services in
`docker-compose.yml`:

1. **`db`** — `postgres:16-alpine`, named volume `grader_grader-db-data`, `pg_isready`
   healthcheck.
2. **`piston`** — `ghcr.io/engineer-man/piston`, `privileged: true`, named volume
   `grader_piston-data`. Healthcheck is a **bash `/dev/tcp` TCP probe** on port 2000,
   not curl/wget — the image ships neither.
3. **`piston-init`** — one-shot `node:20-alpine` that POSTs to Piston's package API to
   install **Python 3.10.0**, then exits 0. The fresh Piston image ships no languages;
   without this the grader cannot run student code. The install persists in
   `grader_piston-data`, so on later `up` it reports `Already installed` and exits.
4. **`migrate`** — one-shot build target that runs `npx tsx scripts/setup-db.ts`
   (apply `schema.sql` + seed the Admin and seed course `01076021`), then exits 0.
   Idempotent.
5. **`app`** — Next.js standalone (`output: 'standalone'` in `next.config.ts`), built
   in a multi-stage `Dockerfile` (`deps` → `builder` → `runner`), published on
   `${APP_PORT:-3000}:3000`. It `depends_on` `db` (healthy) + `migrate`
   (completed) + `piston-init` (completed).

### Two env files, two readers

- **`.env`** — read **automatically by Docker Compose** for variable interpolation
  (`SESSION_SECRET`, `NEXTAUTH_URL`, `GOOGLE_*`, `ANTHROPIC_API_KEY`, `APP_PORT`).
  `SESSION_SECRET` is required (`${SESSION_SECRET:?…}`) — Compose refuses to start
  without it.
- **`.env.local`** — read by **Next.js / `npm run dev` on the host**, and by the
  `scripts/*.ts` helpers when run directly on the host.

Compose does **not** read `.env.local`. In-container `DATABASE_URL` and `PISTON_URL`
are set in `docker-compose.yml` to the **service names** (`postgresql://…@db:5432/…`,
`http://piston:2000/api/v2`), so the `localhost`/`5433` values in `.env.local` are
host-only and correctly do not apply inside the stack. Both files are gitignored
(`.env*`).

### Port 3000 by default

`APP_PORT` defaults to 3000 so the app and the registered Google OAuth redirect
(`http://localhost:3000/api/auth/callback/google`) line up out of the box. On Windows,
WinNAT/Hyper-V can *dynamically reserve* the range that contains 3000 (observed:
2928–3027), which makes Docker fail to bind with `bind: …forbidden`. The override is
`APP_PORT` (e.g. 3100) **plus a matching `NEXTAUTH_URL`** — but the documented,
preferred state is 3000 (see README troubleshooting for the WinNAT workaround).

### `local/` for machine-local artifacts

Non-committed, machine-local files (DB dumps, saved notes, exports) live under a
single gitignored `local/` folder, also listed in `.dockerignore` so they never enter
the build context or an image layer. This keeps sensitive data (a dump carries real
user emails + bcrypt hashes) out of both git and Docker.

## Consequences

**Positive**
- One command (`docker compose up -d --build`) brings up a working system — DB
  migrated/seeded, Piston with Python, app served — with no host Node/Postgres/Piston
  setup beyond Docker itself.
- The fragile, easily-forgotten step (installing Python into a blank Piston) is now a
  declared service with an ordering gate, not a manual `curl`.
- Host-based dev (`npm run dev` + `.env.local`) still works unchanged for fast
  iteration; the two paths coexist.

**Negative / costs**
- **Two env files** is a real footgun: a value set only in `.env.local` is invisible
  to Compose (this is exactly what broke the first fresh `up` — a missing
  `SESSION_SECRET`). The split must be documented wherever setup is described.
- One-shot `migrate` / `piston-init` containers linger in `docker ps -a` as
  `Exited (0)`; that is normal, but looks like noise and is recreated on every `up`.
- `migrate` **seeds on every `up`**, so restoring real data into the stack means
  loading over the seed (see README restore procedure) — the seed Admin/course are
  re-ensured idempotently and do not clobber restored rows.
- Windows WinNAT can reserve port 3000; setup is otherwise zero-config but this one
  platform quirk needs a troubleshooting note.

**No application code or schema change** — this is purely build/runtime packaging.
Tests are unaffected (462 / 63, pg-mem, no Docker required).
