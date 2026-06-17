# CE-Grader Handoff — 2026-06-17

## Project location
`C:\Users\khtha\OneDrive\Desktop\Code\grader`  
GitHub: `https://github.com/khthana/grader`  
Branch: `main` (commit directly, no PRs)

## Current state: feature-complete

The app has **no ComingSoon stubs remaining**. All planned pages are live. See `CLAUDE.md` for full architecture reference — it was just updated to reflect the current state.

**Test suite:** 314 tests / 54 files, all passing. Run with `npx vitest run`.

**Last 5 commits:**
```
4c4f0dc docs: update CLAUDE.md to reflect feature-complete state
a3f6cb0 feat: pending submission review queue / ตรวจงาน (#24)
ddf530f feat: student assignments view (งานที่ได้มอบหมาย) (#23)
b293a1b feat: gradebook (สมุดคะแนน) — student x problem score matrix (#22)
e0ba1a2 feat: instructor submission review + score override (#21)
```

**GitHub issues:** All closed (#1–#21). Issues #22–#24 were built this session but never had GitHub issues created.

## What was built this session (#21–#24 + docs)

### #21 — Instructor submission review + score override
- `reviewSubmission(db, id, { manualScore, reviewedBy })` in `src/lib/submissions/repository.ts`
- `GET/PUT /api/courses/[id]/problems/[pid]/submissions/[sid]` — detail + review (Instructor/Admin only for PUT)
- `GET /api/courses/[id]/problems/[pid]/submissions` — list (TA read-only)
- `/problems/[id]/submissions` page — `SubmissionsTable` with inline score-override dialog
- Eye-icon in `ProblemsTable` linking to submissions page
- Student problem page shows their last effective score

### #22 — Gradebook (สมุดคะแนน)
- `getGradebook(db, courseId)` in `src/lib/gradebook/repository.ts` — matrix of enrolled students × problems with `effectiveScore = COALESCE(manual_score, points_earned)` from latest submission
- `GET /api/courses/[id]/gradebook`
- `/gradebook` page — `GradebookTable` (week-grouped columns, color-coded cells, per-student totals)

### #23 — Student assignments view (งานที่ได้มอบหมาย)
- `getStudentAssignments(db, courseId, userId)` in `src/lib/assignments/repository.ts`
- `GET /api/courses/[id]/assignments` — returns calling user's own assignments
- **Key fix:** `listCoursesForUser` extended to `UNION enrollments` so enrolled students pass `authorizeCourse`
- `/assignments` page — `AssignmentsList` grouped by week, status badges, "เปิดโจทย์" links

### #24 — Pending review queue (ตรวจงาน)
- `listPendingSubmissions(db, courseId)` in `src/lib/submissions/repository.ts` — all `reviewed_at IS NULL` submissions, oldest first, with problem + student info
- `GET /api/courses/[id]/review`
- `/review` page — `PendingQueue` with inline score-override dialog + "ดูทั้งหมด" link

## Key architecture facts (non-obvious)

1. **Effective score** everywhere = `COALESCE(manual_score, points_earned)` — `manual_score` is the instructor override.
2. **`listCoursesForUser`** now does `course_instructors UNION enrollments` — students can access course-scoped API routes.
3. **`authorizeCourse(req, id)`** (no options) = any entitled user (Instructor/TA/Student enrolled). `{ manage: true }` = Instructor/Admin only. `{ mutate: true }` = Instructor/Admin (TA read-only).
4. **pg-mem gotchas:** no `DISTINCT ON`, no `STRING_AGG`, explicit `::int` casts required. Use `MAX(submitted_at)` + INNER JOIN subquery for "latest per group".
5. **Schema path depths** (count of `../` from test file to `schema.sql` at root):
   - `src/lib/X/` → 3
   - `src/app/api/courses/[id]/` → 6
   - `src/app/api/courses/[id]/problems/[pid]/` → 7
   - `src/app/api/courses/[id]/problems/[pid]/submissions/` → 8

## Key files for new features
- `src/lib/submissions/repository.ts` — all submission logic
- `src/lib/gradebook/repository.ts` — gradebook matrix
- `src/lib/assignments/repository.ts` — student assignment view
- `src/lib/courses/authorize.ts` — `authorizeCourse` gate used by all `/api/courses/*` routes
- `src/lib/courses/repository.ts` — `listCoursesForUser` (entitlement)
- `schema.sql` — single source of truth for DB schema

## Possible next work
No open issues. The product is feature-complete per the original spec. Potential extensions:
- Excel export of the gradebook
- Plagiarism / similarity detection between submissions
- Email/notification on submission reviewed
- Multi-language support (currently Python 3.10 only via Piston)
- Student can view their own past submission code + test results (currently instructors can, students cannot)

## Suggested skills
- `/tdd #N` — to implement a new feature slice with TDD (create the GitHub issue first with `gh issue create`)
- `/to-issues` — to break a new PRD or feature concept into vertical-slice issues
- `/to-prd` — to write a PRD from a feature concept before breaking into issues

## Environment
- Windows 11, PowerShell primary (Bash also available)
- `npx vitest run` — always works; `npm test` may fail (PATH issue on this machine)
- Docker grader-db on port 5433: `postgresql://grader:grader@localhost:5433/grader`
- Dev server: `npm run dev` (Turbopack, port 3000)
- `.env.local` has `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `NEXTAUTH_URL`
- Commit style: `feat: description (#N)` directly to `main` with `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` trailer
