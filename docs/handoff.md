# Handoff — CE-Grader (course roster feature complete)

**Repo:** `C:\Users\khtha\OneDrive\Desktop\Code\grader` · GitHub `khthana/grader` · branch `main` (clean, pushed through `13fb237`).
**As of:** 2026-06-17. Tests: **228 passing / 40 files** (`npx vitest run`). Lint clean, `npm run build` green.

> Note: `npm test` may fail if `vitest` is not on PATH — use `npx vitest run` instead.

## What's shipped (full history)

### Auth + shell + User Management (pre-roster work)
- Postgres-backed login (email/password + Google OAuth), HMAC-signed session cookie, role-based shell
- Admin **User Management** at `/users`: CRUD, bulk xlsx import, role assignment, activity logs at `/logs`
- Spec: `requirement/prd_auth_shell_user_management.md`

### Course roster & management (issues #9–#16, all closed)
Full **course-scoped student roster + course management** feature. Built TDD, one issue per slice, committed straight to `main`.

| Commit | Issue | Slice |
|---|---|---|
| `b2e2589` | #9 | Course foundation — schema, entitlement, navbar switcher |
| `463739d` | #10 | Course roster view — list, search, group filter, pagination |
| `b08b685` | #11 | Add student to roster — enroll service + POST |
| `2007144` | #12 | Edit + un-enroll roster student |
| `ecdfa30` | #13 | Excel import of course roster |
| `db7a0c2` | #14 | Excel export of course roster |
| `269e04f` | #15 | Course management page `/courses` (CRUD) |
| `300664f` | #16 | Assign instructors/TAs to a course |

Design rationale lives in:
- `CONTEXT.md` — domain glossary (Course, Enrollment, Roster, Group, Program, Year, Course staff)
- `docs/adr/0001-course-scoped-roster.md` — courses/enrollments model + rejected alternatives
- `requirement/prd_teacher_students_roster.md` — PRD (47 user stories, implementation decisions, test plan)
- `CLAUDE.md` → "Course roster & management" section — repos, access gates, enroll service, routes, LogAction union

## Project state

### Done
| Page | Path | Roles |
|---|---|---|
| Login | `/login` | all |
| Dashboard (role resolver) | `/dashboard` | all |
| User Management | `/users` | Admin only |
| Activity Logs | `/logs` | Admin only |
| รายวิชา (Course CRUD + staff) | `/courses` | Admin, Instructor |
| รายชื่อนักศึกษา (Roster) | `/students` | Admin, Instructor (CRUD), TA (read-only) |
| โจทย์ปัญหา (Python editor) | `/problems`, `/problems/[id]` | all |

### Still `ComingSoon` stubs
- **ตรวจงาน** (`/review`) — instructor grade review
- **สมุดคะแนน** (`/gradebook`) — gradebook
- **งานที่ได้รับมอบหมาย** (`/assignments`) — student assignment list

## Likely next work (no spec yet)

The student-facing mockups in `requirement/student/student.jsx` describe three unbuilt screens:

- **`StudentWork`** — assignments by week (งานที่ได้รับมอบหมาย) — the `/assignments` stub
- **`StudentSolve`** — split problem/editor solve view wired to `/api/grade` — already partially exists at `/problems/[id]`, may need redesign for the split-pane layout
- **`StudentScores`** — a student's own scorebook (สมุดคะแนน) — the `/gradebook` stub

**No `assignments`/`submissions`/`scores` data model exists yet** — that's the first design fork. The `enrollments` + `courses` foundation from the roster feature is what these three screens would build on top of. Designing the data model (assignments table, submissions table, per-submission scores) is the critical first step.

There's also an **instructor gradebook** / **ตรวจงาน** side that the student-facing screens depend on — someone needs to create and publish assignments before students can see them.

## Architecture quick-reference

### Database schema (`schema.sql`)
```
users          — identity + bcrypt hash + is_active
roles          — Admin | Instructor | TA | Student (fixed)
user_roles     — many-to-many user ↔ role
user_logs      — audit log (actor/target emails snapshotted)
courses        — code (unique), name_th, name_en, default program
course_instructors — (course_id, user_id) PK; Instructor/TA by global role
enrollments    — (course_id, user_id) unique; study_group, program, year
```

### Key source locations
| Concern | File |
|---|---|
| Route protection | `src/proxy.ts` (Next 16 proxy, Node runtime) |
| Session | `src/lib/auth.ts` (createSessionToken / verifySessionToken) |
| Current user | `src/lib/session.ts` (server components) / `src/lib/auth-guard.ts` (route handlers) |
| Roles logic | `src/lib/roles.ts` — menu, landing, `resolveActiveRole` |
| DB pool | `src/lib/db.ts` — `getDb()` / `setTestDb()` |
| User repo | `src/lib/users/repository.ts` |
| Course repo | `src/lib/courses/repository.ts` |
| Enrollment repo | `src/lib/enrollments/repository.ts` |
| Enroll service | `src/lib/enrollments/enroll.ts` — find-or-create by id_code |
| Course access gates | `src/lib/courses/access.ts` + `src/lib/courses/authorize.ts` |
| Course context (shell) | `src/lib/courses/server.ts#getCourseContext()` |
| Activity log | `src/lib/logs.ts` — writeLog / safeLog / listLogs |

### API surface
```
POST /api/auth/login, logout; GET /api/auth/me
GET/POST /api/users; GET/PUT/PATCH/DELETE /api/users/[id]
PUT /api/users/[id]/roles; POST /api/users/import
GET /api/logs
GET/POST /api/courses; GET/PUT/DELETE /api/courses/[id]
GET/PUT /api/courses/[id]/instructors; GET /api/courses/[id]/instructors/candidates
GET/POST /api/courses/[id]/students
PUT/DELETE /api/courses/[id]/students/[enrollmentId]
POST /api/courses/[id]/students/import
GET /api/courses/[id]/students/export
POST /api/grade
```

## Critical gotchas (learned over prior sessions)

1. **Schema migrations are manual.** `schema.sql` uses `CREATE TABLE IF NOT EXISTS`; `db:setup` is idempotent. But it does **not** auto-load `.env.local`. On Windows/Git-Bash:
   ```
   set -a; . ./.env.local; set +a; npm run db:setup
   ```
   pg-mem rebuilds schema per test, so the suite won't warn you about an un-migrated dev DB.

2. **pg-mem ≠ Postgres:** needs explicit casts (`$1::int`); **`STRING_AGG` unsupported** → group roles in a second query + JS (see `searchStaffCandidates`, `rolesByUserId`).

3. **Test schema path depth:** `readFileSync(new URL("../../schema.sql", import.meta.url))` must climb the exact `../` count for the test file's directory depth; wrong count → `ENOENT … src/schema.sql` and vitest reports "no tests".

4. **`npm test` may fail on `vitest` not found** — use `npx vitest run` if `npm test` fails with "vitest is not recognized."

5. **Pre-existing lint debt:** `src/app/login/page.tsx` + some `*.route.test.ts` trip `react-hooks/set-state-in-effect` (~28 problems). Not from the roster work; `npm run build` still passes. Leave unless asked.

6. **`study_group` vs `group`:** the DB column is `study_group` (SQL reserved word); the app-level field is `group`. The mapping is in the enrollment repository.

## Conventions to honour

- Commit **directly to `main`** (no branches/PRs). User says "commit + push" after each finished slice. End commits with `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` trailer. CRLF warnings are harmless.
- Repos take an injectable `Queryable`; pure modules unit-tested; routes integration-tested on pg-mem via `setTestDb`. Mirror the `users/` + `courses/` + `enrollments/` structure.
- New authed **page** routes go in `src/proxy.ts` `config.matcher`; API routes self-guard.
- **Icons: `react-icons`** (installed). No MUI, no framer-motion. Animations are CSS keyframes.
- Tailwind v4 with `@import "tailwindcss"` + brand tokens via `@theme` in `globals.css` (primary `#0F2A60`, secondary `#003296`).

## Suggested workflow for next feature

1. **Design** — stress-test against `CONTEXT.md` and ADRs first (what new domain objects are needed?).
2. **PRD** — write the spec in `requirement/` following the pattern of `prd_teacher_students_roster.md`.
3. **Issues** — create tracer-bullet GitHub issues on `khthana/grader`, one per slice.
4. **TDD** — implement each issue red→green→refactor (the cadence used for #9–#16).
5. **Verify** — run the app and test the golden path in browser (remember `db:setup` after schema edits).
6. **Commit + push** — commit to `main` and push; close the GitHub issue manually.
