# CE-Grader Handoff — 2026-06-17

## Project location
`C:\Users\Terry\Desktop\Code\grader`
GitHub: `https://github.com/khthana/grader`
Branch: `main` (commit directly, no PRs)

## Current state: feature-complete

The app has **no ComingSoon stubs remaining**. All planned pages are live. See `CLAUDE.md` for the full architecture reference (kept current).

**Test suite:** 362 tests / 62 files, all passing. Run with `npx vitest run`.

**GitHub issues:** All closed. The most recent epic was Admin impersonation (#27 parent, #28 enter, #29 exit) — all closed.

**Last commits:**
```
76a8109 feat: admin impersonation — exit mode (#29)
2641fb5 feat: admin impersonation — enter mode (#28)
91e5e20 feat: hide course switcher on non-course-scoped pages
8f7b411 fix: refresh navbar course switcher after course mutations
67023a3 feat: import KMITL exam-sheet format for users and roster
ccb58e5 docs: add Teacher Scorebook spec + mockup (#22)
8794a30 feat: Scorebook Excel export (#26)
```
> Note: `2641fb5`'s subject on the remote carries a stray leading `@ ` (a here-string quoting slip); the body and code are correct. Cosmetic only — fixing it needs a force-push.

## What was built this session

### Teacher Scorebook (#22–#26)
- `src/lib/gradebook/status.ts` — pure `deriveScorebookStatus` 4-state worst-wins (missing > late > complete > none-due). See `docs/adr/0003-scorebook-status.md`.
- `src/lib/gradebook/display.ts` — `scoreTier` (hi ≥80% / mid ≥50% / lo / empty), `paginate`.
- `src/lib/gradebook/export.ts` — pure `gradebookToSheet → string[][]` for client-side xlsx export.
- `GradebookTable` visuals: score pills, sticky columns, pagination.
- Spec: `requirement/teacher_score/07-teacher-scorebook.md`.

### KMITL exam-sheet import (`67023a3`)
- `src/lib/import/kmitl.ts` — `splitThaiName` (prefixes longest-first) + `parseKmitlSheet(rows)` (detects "ตอน N" section markers, data rows by `/^\d{6,}$/` id). Imports the KMITL "ใบคะแนนสอบ" `.xls` as **Users** (email = `{รหัส}@kmitl.ac.th`) and into a course **roster**. This format **replaced** the old template format.
- Sample file: `requirement/stdfinsec_2568-2-01076105.xls` (the user may swap this; the test asserts structural invariants, not exact counts).

### Navbar course switcher fixes (`8f7b411`, `91e5e20`)
- `router.refresh()` after course mutations so the navbar (server-rendered from `getCourseContext()`) updates immediately.
- `src/lib/courses/scope.ts#isCourseScopedPath` — switcher hidden on `/users`, `/logs`, `/courses` (not course-scoped).

### Admin impersonation (dev-only) — #27/#28/#29
- See the **Admin impersonation** section in `CLAUDE.md` for the full design.
- Enter: `POST /api/users/[id]/impersonate` (requireAdmin, prod→404, self→400). Exit: `POST /api/users/impersonate/exit` (cookie-driven, safe no-op).
- Pure gate `src/lib/users/impersonation.ts#canImpersonate`. Banner via `ImpersonationBanner` + `isImpersonating()`.
- Dev-only enforced server-side (route 404 in prod) and in UI (`allowImpersonation = NODE_ENV !== 'production'`).

## Key architecture facts (non-obvious)

1. **Effective score** everywhere = `COALESCE(manual_score, points_earned)`.
2. **`listCoursesForUser`** does `course_instructors UNION enrollments` — enrolled students pass `authorizeCourse`.
3. **`authorizeCourse(req, id, opts)`** — no opts = any entitled user; `{ staff }` = Admin/Instructor/TA; `{ mutate }` = Admin/Instructor (TA read-only); `{ manage }` = Admin/Instructor only.
4. **Impersonation roles resolve per-request from the session email** — swapping the `session` cookie re-renders the whole shell as the target user, no extra plumbing.
5. **pg-mem gotchas:** no `DISTINCT ON`, no `STRING_AGG`, explicit `::int` casts. Use `MAX(submitted_at)` + INNER JOIN subquery for "latest per group". For env mutation in tests use `vi.stubEnv` (direct `process.env.NODE_ENV =` fails tsc).
6. **Schema path depths** (count of `../` from test file to root `schema.sql`): `src/lib/X/` → 3; `src/app/api/courses/[id]/` → 6; `.../problems/[pid]/` → 7; `.../submissions/` → 8; `src/app/api/users/[id]/impersonate/` and `src/app/api/users/impersonate/exit/` → 6 (the exit route's test needs no DB).
7. **Commit messages on Windows:** use a PowerShell single-quoted here-string (`@'…'@`) for multi-line `-m`; do NOT use that syntax in the Bash tool (it embeds a literal `@`).

## Possible next work
No open issues. Potential extensions: plagiarism/similarity detection between submissions; email/notification on submission reviewed; multi-language support (currently Python 3.10 only via Piston); students viewing their own past submission code + results.

## Environment
- Windows 11, PowerShell primary (Bash also available).
- `npx vitest run` — always works; `npm test` may fail (PATH issue on this machine).
- Docker grader-db on port 5433: `postgresql://grader:grader@localhost:5433/grader`.
- Dev server: `npm run dev` (Turbopack, port 3000).
- `.env.local` (gitignored) has `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `NEXTAUTH_URL`. Google redirect URI = `${NEXTAUTH_URL}/api/auth/callback/google` — re-register if the domain changes.
- Commit style: `feat: description (#N)` directly to `main` with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.
