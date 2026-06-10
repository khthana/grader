# CE-Grader

ระบบตรวจและให้คะแนน Python code ของนักศึกษาอัตโนมัติ (Computer Engineering Python Grader) — นักศึกษาส่ง Python code เข้ามา ระบบรันกับ test cases ผ่าน Piston แล้วให้คะแนนพร้อม feedback. มาพร้อมระบบ login, role-based shell และหน้า **จัดการผู้ใช้ (User Management)** สำหรับผู้ดูแลระบบ.

Faculty of Engineering, KMITL. Standalone product (the sibling `DEEP-QA-*` repos are read-only design references only).

## Tech stack
- **Next.js 16** (App Router, Turbopack) · TypeScript · React 19
- **Tailwind CSS v4** + `react-icons` (no MUI / framer-motion / react-router)
- **PostgreSQL** via raw `pg` + SQL · **bcryptjs** password hashing
- HMAC-signed session cookie · Google OAuth (optional) · route protection via Next 16 `proxy`
- **Vitest** + **pg-mem** for tests · `xlsx` for bulk import (client-side)

## Prerequisites
- Node.js 20+ (developed on 22)
- A PostgreSQL database reachable via `DATABASE_URL` (see Docker quick-start below)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local`:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/db
   SESSION_SECRET=<long-random-string>
   NEXTAUTH_URL=http://localhost:3000
   # optional — Google login degrades gracefully if omitted
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   ```

3. (Optional) spin up Postgres with Docker:
   ```bash
   docker run -d --name grader-db --restart unless-stopped \
     -e POSTGRES_USER=grader -e POSTGRES_PASSWORD=grader -e POSTGRES_DB=grader \
     -p 5433:5432 -v grader-db-data:/var/lib/postgresql/data postgres:16-alpine
   # DATABASE_URL=postgresql://grader:grader@localhost:5433/grader
   ```

4. Create tables and seed the initial Admin:
   ```bash
   npm run db:setup
   ```
   Default Admin login: **admin@kmitl.ac.th** / **Password123!**

5. Run the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 (you'll be redirected to `/login`).

## Scripts
| Command | Description |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Run the Vitest suite |
| `npm run test:watch` | Vitest watch mode |
| `npm run db:setup` | Apply `schema.sql` + seed Admin (needs `DATABASE_URL`) |

## Testing
Unit tests cover the pure modules (session, password, roles, breadcrumbs, validation, import, name); repository and API routes are integration-tested against an in-memory Postgres (**pg-mem**) — no Docker needed to run the suite.

```bash
npm test
```

## Project layout
- `src/app/(app)/` — authenticated pages wrapped by the role-based shell
- `src/app/api/` — route handlers (auth, users, logs, grade)
- `src/lib/` — domain logic (auth, db, repository, roles, validation, import, logs)
- `src/components/` — shell + User Management + editor UI
- `src/proxy.ts` — route protection (Next 16 proxy, Node runtime)
- `schema.sql` — database schema

For architecture details and conventions, see [CLAUDE.md](CLAUDE.md).
