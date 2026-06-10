# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
ระบบตรวจและให้คะแนน Python code ของนักศึกษาอัตโนมัติ — นักศึกษาส่ง Python code เข้ามา ระบบรัน ตรวจสอบกับ test cases และให้คะแนนพร้อม feedback

CE-Grader is a **standalone product**. The `DEEP-QA-FRONTEND/` and `DEEP-QA-BACKEND/` repos (siblings of this folder) are **read-only references only** — used for design-system look/feel and UX patterns, never extended or imported at runtime.

The app now has a working authenticated experience: Postgres-backed login (email/password + Google OAuth), a role-based shell, and a functional Admin **User Management** module. Teaching/student feature pages (รายชื่อนักศึกษา · ตรวจงาน · สมุดคะแนน · งานที่ได้มอบหมาย) are styled **"coming soon" stubs**; โจทย์ปัญหา links to the existing Python editor. The original spec for this work is `requirement/prd_auth_shell_user_management.md` (delivered).

## Commands
- `npm run dev` — start dev server (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm test` — run the Vitest suite once (`vitest run`)
- `npm run test:watch` — Vitest in watch mode
- `npm run db:setup` — apply `schema.sql` and seed the initial Admin (needs `DATABASE_URL`)

## Architecture

### Routing & the authed shell
- **Next.js 16 (App Router) · TypeScript · Tailwind v4.** All routes live under `src/app/`.
- Authenticated pages live in the **`src/app/(app)/` route group**, whose `layout.tsx` renders the shell (navbar + collapsible sidebar + breadcrumb + toast host) around every page. Routes: `/dashboard` (role landing resolver), `/users`, `/logs`, `/students`, `/problems` (+ `/problems/[id]`), `/review`, `/gradebook`, `/assignments`.
- **Route protection is `src/proxy.ts`** — Next 16 renamed `middleware` to **`proxy`**, which runs on the **Node.js runtime** (so `node:crypto` session verification works). It redirects unauthenticated users to `/login` and authenticated users away from `/login`. The `config.matcher` lists every protected path; add new authed routes there.
- `/login` and the auth API routes are outside the `(app)` group.

### Authentication & session
- **Session cookie:** HMAC-SHA256-signed token (`<base64url(payload)>.<signature>`) via `src/lib/auth.ts`, payload `{ email, name, picture, exp }`, 8h expiry, signed with `SESSION_SECRET`. Pure module — `createSessionToken` / `verifySessionToken`.
- **Passwords:** bcrypt via `bcryptjs` (`src/lib/password.ts` — `hashPassword` / `verifyPassword`). Passwords are optional (Google-only accounts have a null hash).
- **User lookup is Postgres-backed** (no more in-memory store). `POST /api/auth/login` validates against the DB (401 wrong password, 403 unregistered) and sets the cookie; `POST /api/auth/logout` clears it; `GET /api/auth/me` returns the current user + roles; the Google callback resolves the user from Postgres.
- Resolve the current user: `getCurrentUser()` (`src/lib/session.ts`, server components, reads `next/headers` cookies) or `getUserFromRequest(req)` / `requireAdmin(req)` (`src/lib/auth-guard.ts`, route handlers, reads `NextRequest`).

### Roles & landing
- Four roles: **Admin / Instructor / TA / Student**, many-to-many (`user_roles`); **Admin is a superset**. Priority Admin > Instructor > TA > Student.
- `src/lib/roles.ts` (pure, unit-tested) maps a role to its sidebar menu, default landing route, and assignable roles; `resolveActiveRole(roles, requested?)` picks the active role (cookie `active_role` drives the navbar switcher). Landing: Admin → `/users`, Instructor/TA → `/students`, Student → `/assignments`. `/dashboard` redirects to the active role's landing.
- `src/lib/breadcrumbs.ts` (pure, unit-tested) derives Thai-labelled crumbs from the pathname.

### Data layer (Postgres, raw `pg` + SQL)
- `schema.sql` defines `users`, `roles`, `user_roles`, `user_logs`. `npm run db:setup` (`scripts/setup-db.ts`) applies it and seeds an Admin.
- `src/lib/db.ts` — lazy singleton `pg` Pool from `DATABASE_URL` via `getDb()`. **Test seam:** `setTestDb(pool)` injects a pg-mem pool in tests; `setTestDb(null)` resets.
- `src/lib/users/repository.ts` — all user SQL, taking an injectable `Queryable`: `createUser`, `findUserByEmail`, `getUserById`, `getUserWithRoles`, `listUsers` (search + pagination), `updateUser`, `deleteUser`, `setUserActive`, `assignRole`, `setUserRoles`, `countUsersWithRole`.
- The single `users` table stores a display `name` plus structured Thai/English title/first/last, phone, nullable `id_code`, bcrypt hash, `is_active`. A student is a user with the Student role.

### User Management (Admin only — every `/api/users*` route is Admin-gated via `requireAdmin`)
- `GET /api/users` — search + pagination → `{ users, total, page, pageSize }`.
- `POST /api/users` — create (validated, bcrypt if password, assigns roles, logs). `GET/PUT/PATCH/DELETE /api/users/[id]` — detail / edit / activate-toggle / delete.
- `PUT /api/users/[id]/roles` — replace the role set; **409 if it would remove the system's last Admin**.
- `POST /api/users/import` — bulk import: accepts parsed rows, creates valid ones, returns per-row results; bad rows never block good ones.
- `src/lib/users/validation.ts` (pure, shared client+server): required firstNameTh/lastNameTh/email/idCode, email format, optional password policy (8+ with a letter and a digit), valid roles.
- `src/lib/users/import.ts` (pure): `validateImportRows` normalizes cells, splits the comma-separated roles cell, reuses `validateUserInput`, flags within-sheet duplicate emails.
- `src/lib/users/name.ts` (pure): `resolveNameFields` — prefer structured Thai name, else split the display name (so the edit form prefills for legacy users).
- UI: `src/components/users/` — `UsersTable` (search/pagination/row actions), `UserFormDialog` (create/edit), `RolesDialog`, `ImportDialog` (client-side **xlsx** parse + template download). Shell + shared UI in `src/components/shell/`.

### Activity logging
- `src/lib/logs.ts` — `writeLog` / `safeLog` (best-effort, never breaks the operation) / `listLogs` (action filter, newest-first, pagination). Actions: `user.create | user.update | user.delete | user.roles | login`, with actor/target id + **email snapshots** (survive deletion).
- Wired into the create/update/delete/role-change endpoints and the login route. Admin views them at `/logs` via `GET /api/logs`.

### Data Flow (Grading)
1. Student opens `/problems/[id]` (inside the shell, behind auth) and submits Python code via `CodeEditor`.
2. `POST /api/grade` (**requires a signed-in user — 401 otherwise**) receives `{ problemId, code, language }`.
3. API calls Piston (`https://emkc.org/api/v2/piston/execute`) once per test case (`src/lib/piston.ts`, Python 3.10.0).
4. Results compared against `expectedOutput` (trimmed string match); score = `(passedTests / totalTests) * 100`.

### Adding a New Problem
Problem data is still duplicated — add to **both**:
1. `src/app/(app)/problems/[id]/page.tsx` → the `problems` map (title, description, examples) and the list in `src/app/(app)/problems/page.tsx`.
2. `src/app/api/grade/route.ts` → the `problems` map (testCases with expectedOutput).

## Testing
- **Vitest** (node environment, `@` alias in `vitest.config.ts`); tests are `src/**/*.test.ts`.
- Pure modules are unit-tested directly (session, password, roles, breadcrumbs, validation, import, name).
- Repository + route handlers are integration-tested against **pg-mem** (in-memory Postgres, no Docker): build a pool with `newDb()` + `mem.public.none(schema.sql)` + `mem.adapters.createPg()`, inject via `setTestDb`, seed through the repository. Route handlers are imported and called with a `NextRequest`; auth is exercised with real `createSessionToken` cookies. pg-mem is stricter than Postgres (needs explicit casts, e.g. `$1::int`).

## Environment Variables
Required in `.env.local`:
```
DATABASE_URL=            # postgresql://user:pass@host:port/db
SESSION_SECRET=          # long random string (HMAC signing key)
GOOGLE_CLIENT_ID=        # optional; Google login degrades gracefully if absent
GOOGLE_CLIENT_SECRET=    # same OAuth client
NEXTAUTH_URL=            # base URL, e.g. http://localhost:3000
```
Google redirect URI to register: `{NEXTAUTH_URL}/api/auth/callback/google`. Seeded Admin defaults: `admin@kmitl.ac.th` / `Password123!`.

### Local dev database
A Postgres is assumed to be reachable via `DATABASE_URL`. Quick local setup with Docker:
```
docker run -d --name grader-db --restart unless-stopped \
  -e POSTGRES_USER=grader -e POSTGRES_PASSWORD=grader -e POSTGRES_DB=grader \
  -p 5433:5432 -v grader-db-data:/var/lib/postgresql/data postgres:16-alpine
# then: DATABASE_URL=postgresql://grader:grader@localhost:5433/grader npm run db:setup
```

## Conventions
- Server Components by default; `'use client'` for interactive components.
- `@/*` resolves to `src/*` (tsconfig). All routes under `src/app/`.
- Tailwind CSS v4 with `@import "tailwindcss"` in `globals.css`; brand tokens (`primary` `#0F2A60`, `primary-hover`, `secondary` `#003296`, `secondary-hover`, `font-thai`) via `@theme` there.
- **Icons: `react-icons` (installed).** `framer-motion` and MUI are intentionally **not** used (per PRD) — animations are CSS (`.content-enter` keyframe in `globals.css`); dialogs/toasts are small custom components.
- Route protection lives in `src/proxy.ts` (Next 16 proxy, Node runtime) — **not** `middleware.ts`.
