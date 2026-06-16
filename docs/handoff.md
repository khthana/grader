# Handoff — CE-Grader (course roster feature complete)

**Repo:** `c:\Users\Terry\Desktop\Code\grader` · GitHub `khthana/grader` · branch `main` (clean, pushed through `d97236f`).
**As of:** 2026-06-16. Tests: **228 passing / 40 files** (`npm test`). Lint clean, `npm run build` green.

## What just shipped
The full **course-scoped student roster + course management** feature (issues #9–#16, all closed). Built TDD, one issue per slice, committed straight to `main`. Don't re-derive the design — it's recorded in:
- `CONTEXT.md` — domain glossary (Course, Enrollment, Roster, Group, Program, Year, Course staff)
- `docs/adr/0001-course-scoped-roster.md` — the course/enrollment-over-users decision + rejected alternatives
- `requirement/prd_teacher_students_roster.md` — the PRD (user stories, modules, test plan)
- `CLAUDE.md` → "Course roster & management" section — repos, `access.ts`/`authorize.ts` gates, `enrollStudent` service, routes, `LogAction` union
- Commits `b2e2589`(#9) `463739d`(#10) `b08b685`(#11) `2007144`(#12) `ecdfa30`(#13) `db7a0c2`(#14) `269e04f`(#15) `300664f`(#16)

Closed issues carry a comment with their commit hash.

## Project state (what exists vs. stubs)
- **Done:** auth/shell/User Management (prior work, `requirement/prd_auth_shell_user_management.md`); `/courses` (CRUD + staff assignment); `/students` (roster view/add/edit/un-enroll + Excel import/export); `/problems` Python editor + `/api/grade` (Piston).
- **Still `ComingSoon` stubs:** `ตรวจงาน` (`/review`), `สมุดคะแนน` (`/gradebook`), `งานที่ได้รับมอบหมาย` (`/assignments`). These are the obvious next features.

## Likely next work (no spec yet)
The student-facing mockups in `requirement/student/student.jsx` describe three unbuilt screens — a fresh agent could spec/build these next:
- `StudentWork` — assignments by week (งานที่ได้รับมอบหมาย)
- `StudentSolve` — split problem/editor solve view wired to grading
- `StudentScores` — a student's own scorebook (สมุดคะแนน)
There is **no `assignments`/`submissions`/`scores` data model yet** — that's the first design fork (mirrors how the roster needed courses/enrollments). The roster feature now provides the `enrollments` + `courses` foundation those would build on.

## Critical gotchas (learned this session, now in CLAUDE.md/README)
1. **Schema migrations are manual.** `schema.sql` is the only source; after editing it, re-apply to the dev DB or you'll hit `relation "…" does not exist` at runtime (pg-mem rebuilds schema per test, so the suite won't warn you). On Windows/Git-Bash:
   `set -a; . ./.env.local; set +a; npm run db:setup`
2. **pg-mem ≠ Postgres:** needs explicit casts (`$1::int`); **`STRING_AGG` unsupported** → group in a second query + JS (see `searchStaffCandidates`).
3. **Test schema path depth:** `readFileSync(new URL("../../…/schema.sql", import.meta.url))` must climb the exact number of `../` for the test file's directory depth; a wrong count throws `ENOENT … src/schema.sql` and vitest reports "no tests".
4. **Pre-existing lint debt:** `src/app/login/page.tsx` + some `*.route.test.ts` trip the strict `react-hooks/set-state-in-effect` rule (~28 problems) — NOT from this work; `npm run build` still passes. Leave unless asked.

## Conventions to honour
- Commit **directly to `main`** (no branches/PRs); user says "commit + push" after each finished slice; end commits with the `Co-Authored-By: Claude Opus 4.8` trailer; CRLF warnings are harmless. Closing GitHub issues is manual.
- Repos take an injectable `Queryable`; pure modules unit-tested; routes integration-tested on pg-mem via `setTestDb`. Mirror existing `users/` + `courses/` + `enrollments/` structure.
- New authed **page** routes go in `src/proxy.ts` `config.matcher`; API routes self-guard.

## Suggested skills
- **grill-with-docs** — to stress-test the next feature's design against `CONTEXT.md`/ADRs (the user's standard opening move).
- **to-prd** then **to-issues** — turn the agreed design into a PRD + tracer-bullet issues on `khthana/grader` (matches this project's cadence).
- **tdd** — implement each issue red→green→refactor (the cadence used for #9–#16).
- **verify** / **run** — drive the app to confirm a slice works in the browser (remember the manual `db:setup` after schema edits).
