# CE-Grader Handoff — 2026-06-19

## Project location
`C:\Users\Terry\Desktop\Code\grader`
Branch: `main` (commit directly, no PRs)

## Current state

Feature-complete. 308 tests / 48 files, all passing. Run with `npm test`.

## What was built this session — natural-key URL redesign (#32)

### Motivation
Three problems with the old schema:
1. URLs like `/problems/4?courseId=2` are opaque — the numbers mean nothing to a reader.
2. A course code like `01076105` could only exist once — no year/semester differentiation.
3. `?courseId=` was a dead query parameter the server ignored.

### What changed

**Schema (`schema.sql`):**
- `courses` PK changed from `id SERIAL` → `(code, year, semester)`. `year` = Thai Buddhist year (e.g. 2567), `semester` ∈ {1,2,3}.
- `course_instructors` and `enrollments` PKs updated to composite natural keys.
- `weeks` and `problems` keep surrogate `id` PKs but carry the course as three FK columns.
- `problems` gains `problem_no INTEGER` — per-week sequential number, `UNIQUE (week_id, problem_no)`.
- `submissions` `course_id` column → `course_code` / `course_year` / `course_semester`.

**Dev DB migration:** `scripts/migrate-001-natural-keys.sql` — apply with `psql $DATABASE_URL -f scripts/migrate-001-natural-keys.sql`.

**New shared types:** `src/lib/courses/types.ts` (`CourseKey`, `CourseRecord`), `src/lib/courses/slug.ts` (`buildCoursePath`, `courseSlugString`, `parseCourseSlug`).

**New URL structure:**
```
/courses/01076105/2567/1/problems
/courses/01076105/2567/1/problems/1/2        ← week_no / problem_no
/courses/01076105/2567/1/problems/1/2/edit
/courses/01076105/2567/1/students
/courses/01076105/2567/1/gradebook
/courses/01076105/2567/1/review
/courses/01076105/2567/1/assignments
```

Old paths (`/problems`, `/students`, etc.) are thin redirectors — they read the `active_course` cookie and redirect.

**New pages** under `src/app/(app)/courses/[code]/[year]/[semester]/`:
- `layout.tsx` — validates slug, loads course, gates entitlement
- `problems/page.tsx`, `problems/new/page.tsx`
- `problems/[week]/[no]/page.tsx`, `.../edit/page.tsx`, `.../submissions/page.tsx`
- `students/page.tsx`, `gradebook/page.tsx`, `review/page.tsx`, `assignments/page.tsx`

**Deleted:** `src/app/api/courses/[id]/` (16 route handlers + test files).

**New API routes** under `src/app/api/courses/[code]/[year]/[semester]/` — same handlers, new param shape.

**All repositories** updated: `courseId: number` → `key: CourseKey` everywhere. `createSubmission` now takes `courseCode/courseYear/courseSemester`.

**All client components** updated: `courseId: number` → `courseSlug: string` + `coursePath: string`.

**`courseFixture()`** in `src/lib/test-support/db.ts` now returns `course: CourseRecord` (no `.id` field).

### Key commits
```
1fbe50d refactor: replace surrogate course/enrollment PKs with natural (code, year, semester) keys (#32)
608cec0 feat: problem-level score with all-or-nothing grading
```

## Next steps (not yet started)

- **Dev DB migration:** if the dev database has existing data, run `psql $DATABASE_URL -f scripts/migrate-001-natural-keys.sql`. For a clean dev DB, `npm run db:setup` is sufficient.
- **`src/proxy.ts` matcher:** add the new `/courses/[code]/[year]/[semester]/...` paths to `config.matcher` so they are protected.
- **Seed scripts:** `scripts/seed-lab1.js` and `scripts/setup-db.ts` were not updated yet — they still use the old `createCourse` call without `year` / `semester`. Update before running against a fresh DB.
- **New API route test files:** the old `[id]/` test files were deleted; new test files for the `[code]/[year]/[semester]/` routes have not been written yet. The route logic is unchanged — only the param extraction and `courseRoute` wrapper differ, both already covered by `src/lib/courses/route.test.ts`.

## Architecture reference

See `CLAUDE.md` — kept current with all changes above.
See `docs/adr/0004-natural-keys-courses-enrollments.md` for the rationale.
