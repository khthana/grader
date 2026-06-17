# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
ระบบตรวจและให้คะแนน Python code ของนักศึกษาอัตโนมัติ — นักศึกษาส่ง Python code เข้ามา ระบบรัน ตรวจสอบกับ test cases และให้คะแนนพร้อม feedback

CE-Grader is a **standalone product**. The `DEEP-QA-FRONTEND/` and `DEEP-QA-BACKEND/` repos (siblings of this folder) are **read-only references only** — used for design-system look/feel and UX patterns, never extended or imported at runtime.

The app is **feature-complete** as of 2026-06-17. All pages are live — no ComingSoon stubs remain. Delivered features:
- **Auth + shell:** Postgres-backed login (email/password + Google OAuth), role-based shell, navbar course switcher.
- **Admin:** User Management (`/users` — CRUD + bulk xlsx import + role assignment), Activity Logs (`/logs`), **dev-only impersonation** (enter another user's session to test their view; persistent banner + one-click exit).
- **Course management:** รายวิชา (`/courses` — CRUD + staff assignment, Admin/Instructor).
- **Roster:** รายชื่อนักศึกษา (`/students` — view/add/edit/un-enroll + Excel import/export).
- **Problems:** `/problems` — Instructor CRUD (title, description, test cases, deadlines); `/problems/[id]` — student view with `mode:run` (visible tests only) / `mode:submit` (all tests, stores Submission); `/problems/[id]/edit` — ProblemEditor; `/problems/new`; `/problems/[id]/submissions` — per-problem submission list with score override.
- **Grading:** `POST /api/grade` runs code via Piston, stores Submission on `mode:submit`, enforces `close_at` / `due_at` deadlines, checks enrollment.
- **Review:** `/review` (ตรวจงาน) — cross-problem pending queue for Instructor; inline score-override dialog.
- **Gradebook:** `/gradebook` (สมุดคะแนน) — student × problem score matrix with `COALESCE(manual_score, points_earned)` effective score.
- **Assignments:** `/assignments` (งานที่ได้มอบหมาย) — student's own problem list with status badges and effective scores.

Specs: `requirement/prd_auth_shell_user_management.md`, `requirement/prd_teacher_students_roster.md`. Design rationale: `CONTEXT.md` (glossary), `docs/adr/0001-course-scoped-roster.md`, `docs/adr/0002-two-tier-deadline.md`.

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
- Authenticated pages live in the **`src/app/(app)/` route group**, whose `layout.tsx` renders the shell (navbar + collapsible sidebar + breadcrumb + toast host) around every page. Routes: `/dashboard` (role landing resolver), `/users`, `/logs`, `/courses`, `/students`, `/problems` (+ `/problems/[id]`, `/problems/new`, `/problems/[id]/edit`, `/problems/[id]/submissions`), `/review`, `/gradebook`, `/assignments`.
- The navbar also hosts a **course switcher** (the active course persists in an `active_course` cookie, mirroring `active_role`). `src/lib/courses/server.ts#getCourseContext()` resolves `{ courses, activeCourse }` for the shell + course-scoped pages.
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
- `schema.sql` defines all tables. Core: `users`, `roles`, `user_roles`, `user_logs`. Course domain: `courses`, `course_instructors`, `enrollments` (`study_group` — `group` is a SQL reserved word). Problems domain: `weeks` (`course_id`, `week_no` 1–18, `topic`), `problems` (`course_id`, `week_id`, `title`, `description`, `input_spec`, `output_spec`, `due_at`, `close_at`, `language`), `test_cases` (`problem_id`, `input`, `expected_output`, `is_hidden`, `score`, `sort_order`), `submissions` (`problem_id`, `user_id`, `course_id`, `code`, `language`, `points_earned`, `points_max`, `is_late`, `results` jsonb, `reviewed_at`, `reviewed_by`, `manual_score`). FK `ON DELETE CASCADE` everywhere. `npm run db:setup` applies schema + seeds Admin + one course. **After any `schema.sql` change, re-run `db:setup` against dev DB.**
- `src/lib/db.ts` — lazy singleton `pg` Pool from `DATABASE_URL` via `getDb()`. **Test seam:** `setTestDb(pool)` injects a pg-mem pool in tests; `setTestDb(null)` resets.
- `src/lib/users/repository.ts` — `createUser`, `findUserByEmail`, `getUserById`, `getUserWithRoles`, `listUsers`, `updateUser`, `deleteUser`, `setUserActive`, `assignRole`, `setUserRoles`, `countUsersWithRole`.
- `src/lib/courses/repository.ts` — `createCourse`, `getCourseById`, `findCourseByCode`, `listCourses`, `updateCourse`, `deleteCourse`, `listCoursesForUser(userId, roles)` (**entitlement: Admin all; others: `course_instructors` UNION `enrollments`**), `assignInstructor`, `setCourseInstructors`, `listCourseInstructors`, `searchStaffCandidates`.
- `src/lib/enrollments/repository.ts` — `createEnrollment`, `findEnrollment`, `getEnrollmentById`, `listEnrollments`, `listAllEnrollments`, `listGroups`, `updateEnrollment`, `deleteEnrollment`.
- `src/lib/weeks/repository.ts` — `seedWeeks(db, courseId)` (inserts weeks 1–18 if absent), `listWeeks`, `updateWeek`.
- `src/lib/problems/repository.ts` — `createProblem`, `getProblemById` (includes `testCases[]`), `listProblems` (includes `pointsMax` via SUM), `updateProblem`, `deleteProblem`, `setTestCases` (DELETE+INSERT atomically).
- `src/lib/submissions/repository.ts` — `createSubmission`, `listSubmissions`, `countSubmitted`, `countPending`, `getSubmission`, `reviewSubmission` (sets `manual_score`/`reviewed_by`/`reviewed_at`), `listSubmissionsForProblem` (with `effectiveScore`), `getLastSubmission`, `listPendingSubmissions` (cross-problem pending queue for `/review`).
- `src/lib/gradebook/repository.ts` — `getGradebook(db, courseId)` → `{ problems: GradebookProblem[], students: GradebookStudent[] }` where `student.scores[problemId]` = `COALESCE(manual_score, points_earned)` from latest submission.
- `src/lib/assignments/repository.ts` — `getStudentAssignments(db, courseId, userId)` → `AssignmentItem[]` (each problem + the student's last submission effective score, or null).

### Course roster & management (ADR 0001)
- **Domain (see `CONTEXT.md`):** a **roster student is a User** with the Student role linked to a **Course** via an **Enrollment**; course-local fields (group/program/year) live on the enrollment, identity (sid/`id_code`, prefix, name) on the user.
- **Access helpers** (`src/lib/courses/access.ts`, pure): `resolveActiveCourse`, `canMutateRoster(roles)` (Admin/Instructor mutate; TA view-only), `canManageCourses(roles)` (Admin/Instructor). **Route gating: `authorizeCourse(req, courseIdParam, { mutate?, manage? })`** (`src/lib/courses/authorize.ts`) — 401 / 404 / 403-not-entitled / 403-read-only(mutate) / 403-non-manager(manage). Every `/api/courses*` route uses it.
- **Courses** (`/courses`): `GET/POST /api/courses`; `GET/PUT/DELETE /api/courses/[id]`; `GET/PUT /api/courses/[id]/instructors` (+ `/candidates`).
- **Roster** (`/students`): `GET/POST /api/courses/[id]/students`; `PUT/DELETE …/[enrollmentId]`; `POST …/import`; `GET …/export`. **Enroll service** `src/lib/enrollments/enroll.ts#enrollStudent`.
- **Pure modules:** `enrollments/validation.ts`, `enrollments/import.ts`, `enrollments/export.ts`, `courses/validation.ts`.
- **UI:** `src/components/courses/` and `src/components/students/`.

### Problems & grading
- **Weeks:** `GET/PUT /api/courses/[id]/weeks` (seed on first visit; Instructor edits topic). `src/components/problems/WeekBar.tsx` renders week tabs.
- **Problems (Instructor):** `GET/POST /api/courses/[id]/problems`; `GET/PUT/DELETE /api/courses/[id]/problems/[pid]`. `ProblemEditor` component handles create/edit with live test-case management. `validateProblemInput` (pure): title required, weekId required, ≥1 test case, score ≥ 0, `close_at` ≥ `due_at`.
- **Student view** (`/problems/[id]`): loads problem from DB, shows visible test cases + deadline banners, shows student's last effective score, passes `isClosed` to `CodeEditor`.
- **Grading** (`POST /api/grade`): `mode:run` = visible tests only, no Submission stored; `mode:submit` = all tests, stores Submission, enforces `close_at` (403 if past), checks enrollment for non-privileged users, sets `is_late` if past `due_at`. Calls Piston (`src/lib/piston.ts`, Python 3.10.0). `GradeResult` returns `{ pointsEarned, pointsMax, totalTests, passedTests, results, feedback }`.
- **Two-tier deadline (ADR 0002):** `close_at` checked first → 403 if past; `due_at` → sets `is_late` flag.

### Submission review
- **Per-problem:** `GET /api/courses/[id]/problems/[pid]/submissions` (list with student info, TA read-only); `GET/PUT /api/courses/[id]/problems/[pid]/submissions/[sid]` (detail + review; PUT Instructor/Admin only, sets `manual_score`/`reviewed_by`/`reviewed_at`).
- **Review queue** (`/review`): `GET /api/courses/[id]/review` returns all `reviewed_at IS NULL` submissions for the course, oldest first.
- **Effective score** everywhere = `COALESCE(manual_score, points_earned)`.
- **UI:** `SubmissionsTable` (per-problem, `/problems/[id]/submissions`), `PendingQueue` (`/review`).

### Gradebook & assignments
- **Gradebook** (`/gradebook`, Instructor/Admin): `GET /api/courses/[id]/gradebook` → matrix; `GradebookTable` component with week-grouped columns, color-coded cells, per-student totals.
- **Assignments** (`/assignments`, Student): `GET /api/courses/[id]/assignments` → calling user's problem list with last submission data; `AssignmentsList` grouped by week with status badges.

### User Management (Admin only — every `/api/users*` route is Admin-gated via `requireAdmin`)
- `GET /api/users` — search + pagination. `POST /api/users` — create. `GET/PUT/PATCH/DELETE /api/users/[id]`. `PUT /api/users/[id]/roles` — **409 if removes last Admin**. `POST /api/users/import` — bulk xlsx import.
- `src/lib/users/validation.ts`, `src/lib/users/import.ts`, `src/lib/users/name.ts` — pure helpers.
- UI: `src/components/users/`.

### Admin impersonation (dev-only — never offered in production)
- A gated testing aid: an Admin enters another user's session to verify that user's view, then returns to their own account. The whole shell reflects the impersonated user "for free" because roles resolve per-request from the session email.
- **Pure gate** `src/lib/users/impersonation.ts#canImpersonate({ actorRoles, actorId, targetId, isProduction })` → refuses `production` / `not-admin` / `self`.
- **Enter:** `POST /api/users/[id]/impersonate` (`requireAdmin`) — saves the Admin's current token in an `impersonator` cookie, swaps `session` to a fresh token for the target, clears `active_role`/`active_course`; logs `user.impersonate`. Production → 404, self → 400.
- **Exit:** `POST /api/users/impersonate/exit` — **cookie-driven, no `requireAdmin`** (the impersonated session may be a non-Admin): moves the `impersonator` token back into `session`, deletes `impersonator`, clears `active_*`; a safe no-op when no valid `impersonator` token is present.
- **Shell wiring:** `isImpersonating()` (`src/lib/session.ts`) detects a valid `impersonator` cookie; the `(app)` layout passes `impersonatedName` to `AppShell`, which renders `ImpersonationBanner` ("ออกจากโหมด" → exit route → hard-nav to `/users`). Dev-only is enforced both server-side (route 404 in prod) and in the UI (`/users` page passes `allowImpersonation = NODE_ENV !== 'production'` to `UsersTable`).

### Activity logging
- `src/lib/logs.ts` — `writeLog` / `safeLog` / `listLogs`. `LogAction` union: `user.create|update|delete|roles|impersonate | login | enrollment.add|update|remove|import | course.create|update|delete|staff | problem.create|update|delete`.

### Data Flow (Grading)
1. Student opens `/problems/[id]` — problem + test cases loaded from DB; last submission score shown.
2. Student clicks **รันทดสอบ** (`mode:run`) or **ส่งคำตอบ** (`mode:submit`).
3. `POST /api/grade` validates deadline + enrollment (submit only), runs code via Piston once per test case.
4. On `mode:submit`: stores `Submission` row with `is_late` flag; `mode:run` returns result only.
5. `GradeResult = { pointsEarned, pointsMax, totalTests, passedTests, results[], feedback }` returned to client.

## Testing
- **Vitest** (node environment, `@` alias in `vitest.config.ts`); tests are `src/**/*.test.ts`. **362 tests / 62 files** as of 2026-06-17.
- Pure modules are unit-tested directly (session, password, roles, breadcrumbs, validation, import, name).
- Repository + route handlers are integration-tested against **pg-mem** (in-memory Postgres, no Docker): build a pool with `newDb()` + `mem.public.none(schema.sql)` + `mem.adapters.createPg()`, inject via `setTestDb`, seed through the repository. Route handlers are imported and called with a `NextRequest`; auth is exercised with real `createSessionToken` cookies.
- **pg-mem gotchas:** explicit casts (`$1::int`); no `STRING_AGG` (use second query + JS); no `DISTINCT ON` (use subquery with `MAX(submitted_at)` + inner join); schema path `../` count must match test file depth exactly.
- **Schema path reference** by depth from `src/`:
  - `src/lib/X/` → `../../../schema.sql`
  - `src/app/api/courses/[id]/` → `../../../../../../schema.sql`
  - `src/app/api/courses/[id]/problems/[pid]/` → `../../../../../../../schema.sql`
  - `src/app/api/courses/[id]/problems/[pid]/submissions/` → `../../../../../../../../schema.sql`

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
- **Icons: `react-icons` (installed).** `framer-motion` and MUI are intentionally **not** used — animations are CSS; dialogs/toasts are small custom components.
- Route protection lives in `src/proxy.ts` (Next 16 proxy, Node runtime) — **not** `middleware.ts`. Add new authed **page** routes to `config.matcher`; API routes self-guard.
- **Schema migrations are manual:** `schema.sql` uses `CREATE TABLE IF NOT EXISTS`, and `db:setup` is idempotent — but it doesn't auto-load `.env.local`. On Windows/Git-Bash: `set -a; . ./.env.local; set +a; npm run db:setup`.
