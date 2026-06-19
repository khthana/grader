# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
ระบบตรวจและให้คะแนน Python code ของนักศึกษาอัตโนมัติ — นักศึกษาส่ง Python code เข้ามา ระบบรัน ตรวจสอบกับ test cases และให้คะแนนพร้อม feedback

CE-Grader is a **standalone product**. The `DEEP-QA-FRONTEND/` and `DEEP-QA-BACKEND/` repos (siblings of this folder) are **read-only references only** — used for design-system look/feel and UX patterns, never extended or imported at runtime.

The app is **feature-complete** as of 2026-06-19. All pages are live — no ComingSoon stubs remain. Delivered features:
- **Auth + shell:** Postgres-backed login (email/password + Google OAuth), role-based shell, navbar course switcher.
- **Admin:** User Management (`/users` — CRUD + bulk xlsx import + role assignment), Activity Logs (`/logs`), **dev-only impersonation** (enter another user's session to test their view; persistent banner + one-click exit).
- **Course management:** รายวิชา (`/courses` — CRUD + staff assignment, Admin/Instructor).
- **Roster:** รายชื่อนักศึกษา — accessible via `/courses/[code]/[year]/[semester]/students`.
- **Problems:** `/courses/[code]/[year]/[semester]/problems` — Instructor CRUD; `/courses/.../problems/[week]/[no]` — student view with `mode:run` / `mode:submit`; `…/edit`, `…/submissions`.
- **Grading:** `POST /api/grade` runs code via Piston, stores Submission on `mode:submit`, enforces `close_at` / `due_at` deadlines, checks enrollment.
- **Review:** `/courses/[code]/[year]/[semester]/review` — cross-problem pending queue for Instructor; inline score-override dialog.
- **Gradebook:** `/courses/[code]/[year]/[semester]/gradebook` — student × problem score matrix with `COALESCE(manual_score, points_earned)` effective score.
- **Assignments:** `/courses/[code]/[year]/[semester]/assignments` — student's own problem list with status badges and effective scores.

Specs: `requirement/prd_auth_shell_user_management.md`, `requirement/prd_teacher_students_roster.md`. Design rationale: `CONTEXT.md` (glossary), `docs/adr/`. Dev migration script: `scripts/migrate-001-natural-keys.sql`.

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
- Authenticated pages live in the **`src/app/(app)/` route group**, whose `layout.tsx` renders the shell (navbar + collapsible sidebar + breadcrumb + toast host) around every page.
- **Course-scoped pages** live under `src/app/(app)/courses/[code]/[year]/[semester]/` with a layout (`layout.tsx`) that resolves and validates the slug before rendering children. Sub-routes: `problems/`, `problems/new/`, `problems/[week]/[no]/`, `problems/[week]/[no]/edit/`, `problems/[week]/[no]/submissions/`, `students/`, `gradebook/`, `review/`, `assignments/`.
- **Legacy shortcut pages** (`/problems`, `/students`, `/gradebook`, `/review`, `/assignments`) are thin Server Component redirectors — they read the `active_course` cookie and issue a `redirect()` to the equivalent course-scoped URL.
- The navbar hosts a **course switcher** (active course persists in `active_course` cookie). `src/lib/courses/server.ts#getCourseContext()` resolves `{ courses, activeCourse }`. **Course entitlement follows the active role:** `getCourseContext` and `GET /api/courses` narrow to `[resolveActiveRole(roles, cookie)]`; falls back to full roles when no `active_role` cookie is set.
- **Route protection is `src/proxy.ts`** — Next 16 renamed `middleware` to **`proxy`**, which runs on the **Node.js runtime** (so `node:crypto` session verification works). The `config.matcher` lists every protected path; add new authed page routes there.
- `/login` and the auth API routes are outside the `(app)` group.

### Authentication & session
- **Session cookie:** HMAC-SHA256-signed token (`<base64url(payload)>.<signature>`) via `src/lib/auth.ts`, payload `{ email, name, picture, exp }`, 8h expiry, signed with `SESSION_SECRET`. Pure module — `createSessionToken` / `verifySessionToken`.
- **Passwords:** bcrypt via `bcryptjs` (`src/lib/password.ts` — `hashPassword` / `verifyPassword`). Passwords are optional (Google-only accounts have a null hash).
- **User lookup is Postgres-backed.** `POST /api/auth/login` validates against the DB (401 wrong password, 403 unregistered) and sets the cookie; `POST /api/auth/logout` clears it; `GET /api/auth/me` returns the current user + roles.
- Resolve the current user: `getCurrentUser()` (`src/lib/session.ts`, server components, reads `next/headers` cookies) or `getUserFromRequest(req)` / `requireAdmin(req)` (`src/lib/auth-guard.ts`, route handlers, reads `NextRequest`).

### Roles & landing
- Four roles: **Admin / Instructor / TA / Student**, many-to-many (`user_roles`); **Admin is a superset**. Priority Admin > Instructor > TA > Student.
- `src/lib/roles.ts` (pure, unit-tested) maps a role to its sidebar menu, default landing route, and assignable roles; `resolveActiveRole(roles, requested?)` picks the active role. Landing: Admin → `/users`, Instructor/TA → `/students`, Student → `/assignments`. `/dashboard` redirects to the active role's landing.
- `src/lib/breadcrumbs.ts` (pure, unit-tested) derives Thai-labelled crumbs from the pathname.

### Data layer (Postgres, raw `pg` + SQL)

#### Schema (tables)
`schema.sql` defines all tables. **After any change, re-run `db:setup` against the dev DB.**

Core: `users`, `roles`, `user_roles`, `user_logs`.

Course domain — **natural composite PKs, no surrogate `id`:**
- `courses` — PK `(code, year, semester)`. `year` is Thai Buddhist year (e.g. 2567). `semester` ∈ {1,2,3}.
- `course_instructors` — PK `(course_code, course_year, course_semester, user_id)`.
- `enrollments` — PK `(course_code, course_year, course_semester, user_id)`. Fields: `study_group`, `program`, `year` (student cohort year). No surrogate `id`.

Problems domain — **surrogate `id` + composite FK to courses:**
- `weeks` — `id SERIAL` PK, FK `(course_code, course_year, course_semester)` → courses, `UNIQUE (course_code, course_year, course_semester, week_no)`. New courses seed `DEFAULT_WEEKS`=6 (growable to `MAX_WEEKS`=16).
- `problems` — `id SERIAL` PK, FK `(course_code, course_year, course_semester)` → courses, FK `week_id` → weeks, `problem_no INTEGER` (per-week sequential, auto-assigned), `UNIQUE (week_id, problem_no)`. Fields: `title`, `description`, `input_spec`, `output_spec`, `score`, `due_at`, `close_at`, `language`.
- `test_cases` — `id SERIAL` PK, FK `problem_id`. Fields: `input`, `expected_output`, `is_hidden`, `score`, `sort_order`.
- `submissions` — `id SERIAL` PK, FK `problem_id`, FK `user_id`, FK `(course_code, course_year, course_semester)` → courses. Fields: `code`, `language`, `points_earned`, `points_max`, `is_late`, `results jsonb`, `reviewed_at`, `reviewed_by`, `manual_score`.

#### Key types (`src/lib/courses/types.ts`)
```typescript
export interface CourseKey {
  code: string
  year: number
  semester: number
}

export interface CourseRecord extends CourseKey {
  nameTh: string
  nameEn: string
  program: string | null
  createdAt: string
}
```

#### Slug helpers (`src/lib/courses/slug.ts`)
```typescript
buildCoursePath(key: CourseKey): string          // → "/courses/01076105/2567/1"
courseSlugString(key: CourseKey): string         // → "01076105/2567/1"  (for fetch URLs)
parseCourseSlug(code, year, semester): CourseKey | null
```

#### DB singleton
`src/lib/db.ts` — lazy singleton `pg` Pool via `getDb()`. **Test seam:** `setTestDb(pool)` injects a pg-mem pool; `setTestDb(null)` resets.

#### Repositories
- `src/lib/users/repository.ts` — `createUser`, `findUserByEmail`, `getUserById`, `getUserWithRoles`, `listUsers`, `updateUser`, `deleteUser`, `setUserActive`, `assignRole`, `setUserRoles`, `countUsersWithRole`.
- `src/lib/courses/repository.ts` — `createCourse(db, { code, year, semester, nameTh, nameEn, program? })`, `getCourseByKey(db, key: CourseKey)`, `updateCourse(db, key, data)`, `deleteCourse(db, key)`, `listCoursesForUser(db, userId, roles)` (**entitlement: Admin all; others: `course_instructors` UNION `enrollments`**), `assignInstructor(db, key: CourseKey, userId)`, `setCourseInstructors(db, key, userIds)`, `listCourseInstructors(db, key)`, `searchStaffCandidates(db, key, query)`.
- `src/lib/enrollments/repository.ts` — `createEnrollment(db, { courseCode, courseYear, courseSemester, userId, ... })`, `findEnrollment(db, key, userId)`, `getEnrollmentByUser(db, key, userId)`, `listEnrollments(db, key, opts)`, `listAllEnrollments(db, key)`, `listGroups(db, key)`, `updateEnrollment(db, key, userId, data)`, `deleteEnrollment(db, key, userId)`.
- `src/lib/weeks/repository.ts` — `seedWeeks(db, key: CourseKey)`, `listWeeks(db, key)`, `getWeekByNo(db, key, weekNo)`, `updateWeekTopic(db, weekId, topic)`, `addWeek(db, key)`, `weekHasProblems(db, weekId)`, `deleteWeek(db, weekId)`.
- `src/lib/problems/repository.ts` — `createProblem(db, { courseCode, courseYear, courseSemester, weekId, title, ... })` (auto-assigns `problem_no`), `getProblemById(db, id)` (includes `testCases[]`), `getProblemByWeekAndNo(db, key, weekNo, problemNo)`, `listProblems(db, key, opts)` (includes `pointsMax`, `weekNo`, `problemNo`), `updateProblem`, `deleteProblem`, `setTestCases`.
- `src/lib/submissions/repository.ts` — `createSubmission(db, { problemId, userId, courseCode, courseYear, courseSemester, ... })`, `listSubmissions`, `countSubmitted(db, problemId, key: CourseKey)`, `countPending`, `getSubmission`, `reviewSubmission`, `listSubmissionsForProblem`, `getLastSubmission`, `listPendingSubmissions(db, key: CourseKey)`.
- `src/lib/gradebook/repository.ts` — `getGradebook(db, key: CourseKey)` → `{ problems: GradebookProblem[], students: GradebookStudent[] }` where `student.scores[problemId]` = `COALESCE(manual_score, points_earned)`.
- `src/lib/assignments/repository.ts` — `getStudentAssignments(db, key: CourseKey, userId)` → `AssignmentItem[]`.

### API Route Layer

#### Structure
All course-scoped API routes live under `/api/courses/[code]/[year]/[semester]/`:

```
GET/POST   /api/courses                                       → list / create course
GET/PUT/DELETE /api/courses/[code]/[year]/[semester]          → single course
GET/PUT    /api/courses/[code]/[year]/[semester]/instructors  (+ /candidates)
GET/POST   /api/courses/[code]/[year]/[semester]/weeks
PUT/DELETE /api/courses/[code]/[year]/[semester]/weeks/[wid]
GET/POST   /api/courses/[code]/[year]/[semester]/problems
GET/PUT/DELETE /api/courses/[code]/[year]/[semester]/problems/[pid]
GET        /api/courses/[code]/[year]/[semester]/problems/[pid]/submissions
GET/PUT    /api/courses/[code]/[year]/[semester]/problems/[pid]/submissions/[sid]
GET/POST   /api/courses/[code]/[year]/[semester]/students
PUT/DELETE /api/courses/[code]/[year]/[semester]/students/[userId]
POST       /api/courses/[code]/[year]/[semester]/students/import
GET        /api/courses/[code]/[year]/[semester]/students/export
GET        /api/courses/[code]/[year]/[semester]/review
GET        /api/courses/[code]/[year]/[semester]/gradebook
GET        /api/courses/[code]/[year]/[semester]/assignments
```

#### `courseRoute` wrapper (`src/lib/courses/route.ts`)
Every course-scoped handler is wrapped with `courseRoute({ staff?, mutate?, manage? }, handler)`. It resolves `{ code, year, semester }` from `context.params`, calls `authorizeCourse`, and either returns an error response or calls the handler with `(req, auth, params)`.

```typescript
// CourseAuth (ok path):
{ ok: true; user: UserWithRoles; course: CourseRecord }

// handler accesses:
const { user, course } = auth
// course.code, course.year, course.semester — no courseId number anymore
```

#### `authorizeCourse` (`src/lib/courses/authorize.ts`)
Takes `{ code, year, semester }` slug params, resolves course via `getCourseByKey`, checks user entitlement. Returns 401/404/403 or `{ ok: true, user, course }`.

### Client Component Props
Client components that make API calls receive `courseSlug: string` (e.g. `"01076105/2567/1"`) and/or `coursePath: string` (e.g. `"/courses/01076105/2567/1"`). **Never pass `courseId: number`** — courses have no surrogate id.

| Component | Props |
|-----------|-------|
| `ProblemsTable` | `courseSlug`, `coursePath`, `canManage` |
| `ProblemEditor` | `courseSlug`, `coursePath`, `weeks`, `mode`, `initialWeekId?`, `problem?` |
| `GradebookTable` | `courseSlug` |
| `AssignmentsList` | `courseSlug`, `coursePath` |
| `PendingQueue` | `courseSlug`, `coursePath` |
| `RosterTable` | `courseSlug`, `coursePath`, `canMutate` |
| `StudentFormDialog` | `courseSlug` |
| `RosterImportDialog` | `courseSlug` |
| `SubmissionsTable` | `courseSlug`, `problemId`, `pointsMax` |

Problem links use `weekNo` + `problemNo` (not surrogate `id`): `${coursePath}/problems/${p.weekNo}/${p.problemNo}`.

### Course roster & management (ADR 0001)
- **Domain (see `CONTEXT.md`):** a roster student is a User with the Student role linked to a Course via an Enrollment; course-local fields (group/program/year) live on the enrollment, identity (sid/`id_code`, prefix, name) on the user.
- **Access helpers** (`src/lib/courses/access.ts`, pure): `resolveActiveCourse(courses, slug?)` — matches on `"code/year/semester"` slug string; `canMutateRoster(roles)` (Admin/Instructor mutate; TA view-only); `canManageCourses(roles)` (Admin/Instructor).
- **Route gating:** `authorizeCourse` in `src/lib/courses/authorize.ts` — 401 / 404 / 403-not-entitled / 403-read-only (mutate) / 403-non-manager (manage). Every `/api/courses*` route uses it via `courseRoute`.
- **Enroll service:** `src/lib/enrollments/enroll.ts#enrollStudent`.
- **Pure modules:** `enrollments/validation.ts`, `enrollments/import.ts`, `enrollments/export.ts`, `courses/validation.ts` (validates `code`, `year`, `semester`, `nameTh`, `nameEn`).
- **UI:** `src/components/courses/` and `src/components/students/`.

### Problems & grading
- **Weeks:** `GET /api/courses/[code]/[year]/[semester]/weeks` (list); `POST` (Instructor appends); `PUT …/weeks/[wid]` (edit topic); `DELETE …/weeks/[wid]` (last only, no problems, keep ≥1). `WeekBar` component renders a wrapping `grid-cols-6` of week cards.
- **Problems (Instructor):** `GET/POST /api/courses/.../problems`; `GET/PUT/DELETE …/problems/[pid]`. `ProblemEditor` handles create/edit with live test-case management. `validateProblemInput`: title required, weekId required, ≥1 test case, score ≥ 0, `close_at` ≥ `due_at`.
- **Student view** (`/courses/.../problems/[week]/[no]`): loaded via `getWeekByNo` + `getProblemByWeekAndNo`.
- **Grading** (`POST /api/grade`): `mode:run` = visible tests only, no Submission; `mode:submit` = all tests, stores Submission, enforces `close_at` (403 if past), checks enrollment, sets `is_late` if past `due_at`. Calls Piston (`src/lib/piston.ts`, Python 3.10.0). Returns `GradeResult = { pointsEarned, pointsMax, totalTests, passedTests, results[], feedback }`.
- **Two-tier deadline (ADR 0002):** `close_at` checked first → 403 if past; `due_at` → sets `is_late` flag.

### Submission review
- **Per-problem:** `GET /api/courses/.../problems/[pid]/submissions`; `GET/PUT …/submissions/[sid]` (PUT: Instructor/Admin only).
- **Review queue** (`…/review`): `GET /api/courses/.../review` returns all `reviewed_at IS NULL` submissions, oldest first.
- **Effective score** everywhere = `COALESCE(manual_score, points_earned)`.
- **UI:** `SubmissionsTable` (per-problem), `PendingQueue` (review queue).

### Gradebook & assignments
- **Gradebook** (`…/gradebook`, Instructor/Admin): `GET /api/courses/.../gradebook` → matrix; `GradebookTable` with week-grouped columns, color-coded cells, per-student status dot (ADR 0003). Problem columns headed **"ข้อ N"** (per-week index resetting each week). Excel export labels columns `สัปดาห์ {w} ข้อ {n}`.
- **Assignments** (`…/assignments`, Student): `GET /api/courses/.../assignments` → problem list with last submission data; `AssignmentsList` grouped by week with status badges.

### User Management (Admin only — every `/api/users*` route is Admin-gated via `requireAdmin`)
- `GET /api/users` — search + pagination. `POST /api/users` — create. `GET/PUT/PATCH/DELETE /api/users/[id]`. `PUT /api/users/[id]/roles` — **409 if removes last Admin**. `POST /api/users/import` — bulk xlsx import.
- `src/lib/users/validation.ts`, `src/lib/users/import.ts`, `src/lib/users/name.ts` — pure helpers.
- UI: `src/components/users/`.

### Admin impersonation (dev-only — never offered in production)
- **Pure gate** `src/lib/users/impersonation.ts#canImpersonate({ actorRoles, actorId, targetId, isProduction })` → refuses production / not-admin / self.
- **Enter:** `POST /api/users/[id]/impersonate` (`requireAdmin`) — saves Admin token in `impersonator` cookie, swaps `session` to target, clears `active_role`/`active_course`; logs `user.impersonate`.
- **Exit:** `POST /api/users/impersonate/exit` — cookie-driven, no `requireAdmin`; moves `impersonator` back into `session`, safe no-op when not impersonating.
- **Shell wiring:** `isImpersonating()` (`src/lib/session.ts`) detects `impersonator` cookie; `ImpersonationBanner` renders in `AppShell`.

### Activity logging
- `src/lib/logs.ts` — `writeLog` / `safeLog` / `listLogs`. `LogAction` union: `user.create|update|delete|roles|impersonate | login | enrollment.add|update|remove|import | course.create|update|delete|staff | problem.create|update|delete`.

### Data Flow (Grading)
1. Student opens `/courses/[code]/[year]/[semester]/problems/[week]/[no]` — problem loaded via `getWeekByNo` + `getProblemByWeekAndNo`; last submission score shown.
2. Student clicks **รันทดสอบ** (`mode:run`) or **ส่งคำตอบ** (`mode:submit`).
3. `POST /api/grade` validates deadline + enrollment (submit only), runs code via Piston once per test case.
4. On `mode:submit`: stores `Submission` row with `is_late` flag; `mode:run` returns result only.
5. `GradeResult = { pointsEarned, pointsMax, totalTests, passedTests, results[], feedback }` returned to client.

## Testing
- **Vitest** (node environment, `@` alias in `vitest.config.ts`); tests are `src/**/*.test.ts`. **308 tests / 48 files** as of 2026-06-19.
- Pure modules are unit-tested directly (session, password, roles, breadcrumbs, validation, import, name).
- Repository + route handlers are integration-tested against **pg-mem** (in-memory Postgres, no Docker): build a pool with `newDb()` + `mem.public.none(schema.sql)` + `mem.adapters.createPg()`, inject via `setTestDb`, seed through the repository. Route handlers are imported and called with a `NextRequest`; auth is exercised with real `createSessionToken` cookies.
- **pg-mem gotchas:** explicit casts (`$1::int`); no `STRING_AGG` (use second query + JS); no `DISTINCT ON` (use subquery with `MAX(submitted_at)` + inner join); schema path `../` count must match test file depth exactly.
- **`courseFixture()`** (`src/lib/test-support/db.ts`) seeds: freshDb → Instructor + TA + Course `(C01, 2567, 1)` + `assignInstructor` for both + `seedWeeks`. Returns `{ db, ins, ta, course: CourseRecord }`. Use this as the baseline for any test that needs a course.
- **Schema path reference** by depth from `src/`:
  - `src/lib/X/` → `../../../schema.sql`
  - `src/app/api/courses/` → `../../../../schema.sql`
  - `src/app/api/courses/[code]/[year]/[semester]/` → `../../../../../../schema.sql`
  - `src/app/api/courses/[code]/[year]/[semester]/problems/[pid]/` → `../../../../../../../schema.sql`
  - `src/app/api/courses/[code]/[year]/[semester]/problems/[pid]/submissions/` → `../../../../../../../../schema.sql`

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

**After schema changes on the dev DB:** apply `scripts/migrate-001-natural-keys.sql` for the natural-key migration, or re-create the DB with `db:setup` for a clean slate.

## Conventions
- Server Components by default; `'use client'` for interactive components.
- `@/*` resolves to `src/*` (tsconfig). All routes under `src/app/`.
- Tailwind CSS v4 with `@import "tailwindcss"` in `globals.css`; brand tokens (`primary` `#0F2A60`, `primary-hover`, `secondary` `#003296`, `secondary-hover`, `font-thai`) via `@theme` there.
- **Icons: `react-icons` (installed).** `framer-motion` and MUI are intentionally **not** used — animations are CSS; dialogs/toasts are small custom components.
- Route protection lives in `src/proxy.ts` (Next 16 proxy, Node runtime) — **not** `middleware.ts`. Add new authed **page** routes to `config.matcher`; API routes self-guard.
- **Schema migrations are manual:** `schema.sql` uses `CREATE TABLE IF NOT EXISTS`, and `db:setup` is idempotent — but it doesn't auto-load `.env.local`. On Windows/Git-Bash: `set -a; . ./.env.local; set +a; npm run db:setup`.
- **No surrogate IDs on courses or enrollments.** Always identify a course by `CourseKey = { code, year, semester }`. Client components receive `courseSlug: string` (`"code/year/semester"`) for API fetch paths, and `coursePath: string` (`"/courses/code/year/semester"`) for navigation links.
- **Problem URLs use week + position:** `/courses/.../problems/[weekNo]/[problemNo]`, not problem ID. The surrogate `id` is only used as a stable FK anchor in `test_cases` and `submissions`.
