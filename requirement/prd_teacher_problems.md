# PRD — Teacher Problem Management & Submission Tracking

> Domain glossary: `CONTEXT.md`. Architecture decisions: `docs/adr/0001-course-scoped-roster.md`,
> `docs/adr/0002-two-tier-deadline.md`. UI reference: `requirement/problem/04-teacher-problems.md`,
> `requirement/problem/teacher-problems.jsx`, `requirement/problem/problem.png`.
> Directive: when the project's design conflicts with the mockup, the project's patterns win.

## Problem Statement

An Instructor has no way to create or manage programming problems for their course. The current
`/problems` page is a hardcoded stub showing a single "Hello, World!" problem — there is no
database-backed problem store, no way to organise problems by week, no due dates, and no
visibility into which students have submitted or are late. Meanwhile the `/api/grade` endpoint
runs hardcoded test cases regardless of what any Instructor might want to set. The result is that
the grading infrastructure exists but is unusable in a real course setting.

## Solution

Introduce a real **Problem** domain: course-scoped Problems organised by **Week**, each with one
or more **Test Cases**. Instructors create, edit, and delete Problems through a full-page Problem
Editor. Problems carry a two-tier deadline (**Due Date** soft / **Close Date** hard). Student code
submissions are stored as **Submissions** so Instructors can see who has submitted, who is late,
and override auto-graded scores when needed. The student editor (`/problems/[id]`) loads Problems
from the database end-to-end.

## User Stories

### Week management
1. As an Instructor, I want 8 weeks automatically created when I create a course, so that I can
   start adding problems immediately without setting up a week structure first.
2. As an Instructor, I want to edit the topic of each week (e.g. "พื้นฐาน Python และ I/O"), so
   that the WeekBar labels match my syllabus.
3. As an Instructor, I want a horizontal scrollable WeekBar showing all weeks with their topic, so
   that I can switch between weeks quickly.
4. As an Instructor, I want the currently selected week highlighted in the WeekBar, so that I know
   which week's problems I am viewing.

### Viewing the problem list
5. As an Instructor, I want a table of problems for the selected week (ลำดับ, ชื่อโจทย์+คำอธิบาย,
   คะแนน, กำหนดส่ง, ส่งแล้ว, รอตรวจ, actions), so that I can review my problem set at a glance.
6. As an Instructor, I want "ส่งแล้ว" shown as "X/Y" (submitted/enrolled), so that I can see
   class participation per problem.
7. As an Instructor, I want "รอตรวจ" shown as a count of unreviewed submissions, so that I know
   how many submissions still need my attention.
8. As an Instructor, I want an empty-state row "ยังไม่มีโจทย์ในสัปดาห์นี้" when a week has no
   problems, so that I know the week is empty rather than seeing a broken page.
9. As a TA, I want to view the problem list and editor in read-only mode, so that I can see the
   course content without being able to change it.
10. As an Admin, I want to view and manage problems in any course, so that I can support any class.

### Creating and editing problems
11. As an Instructor, I want an "+ เพิ่มโจทย์" button that opens a full-page Problem Editor
    (not a modal), so that I have enough space to write a detailed problem.
12. As an Instructor, I want the Problem Editor to pre-select the current week, so that I don't
    have to re-select it for every new problem.
13. As an Instructor, I want to fill in: ชื่อโจทย์, รายละเอียดโจทย์, รูปแบบ Input, รูปแบบ Output,
    กำหนดส่ง, วันปิดรับ (optional), and ภาษาที่อนุญาต, so that the problem is fully specified.
14. As an Instructor, I want the total points shown live as I add or edit test case scores, so
    that I always know the problem's total before saving.
15. As an Instructor, I want "ยกเลิก" to return to the problem list without saving, so that I
    can abandon accidental edits.
16. As an Instructor, I want "บันทึกโจทย์" to save the problem and return to the list, so that
    I can confirm my changes quickly.
17. As an Instructor, I want an edit (pen) action per row that opens the Problem Editor prefilled,
    so that I can correct mistakes.
18. As an Instructor, I want a view (eye) action per row that shows a student-preview of the
    problem, so that I can see what students will see.

### Test Cases
19. As an Instructor, I want to add multiple test cases to a problem, each with Input and
    Expected Output fields, so that I can cover edge cases.
20. As an Instructor, I want each test case to have a score (points) field, so that different
    cases can be weighted differently.
21. As an Instructor, I want a "ซ่อนจากนักศึกษา" checkbox per test case, so that I can keep
    some cases hidden from the student's run-test view.
22. As an Instructor, I want a summary in the Test Case card header ("N ชุด · รวม M คะแนน")
    that updates live, so that I can track the test suite at a glance.
23. As an Instructor, I want to delete a test case (with a trash button, visible only when more
    than one exists), so that I can remove cases I no longer need.

### Deadlines
24. As an Instructor, I want an optional กำหนดส่ง (due_at) per problem, so that students know
    when on-time submission ends.
25. As an Instructor, I want an optional วันปิดรับ (close_at) per problem, so that I can hard-
    close the submission window when needed.
26. As a Student, I want to see the กำหนดส่ง on the problem page, so that I know when I need
    to submit.
27. As a Student, I want my submission accepted after กำหนดส่ง but before วันปิดรับ, so that I
    can still submit late work.
28. As a Student, I want a clear error message when I try to submit after วันปิดรับ, so that
    I know the window is closed.
29. As an Instructor, I want to see which students submitted late (is_late flag), so that I can
    apply a late penalty if needed.

### Submission & auto-grading
30. As a Student, I want to submit Python code and receive a per-test-case pass/fail result with
    points earned, so that I know exactly how I scored.
31. As a Student, I want hidden test cases to run at submit time but not be shown to me, so that
    the Instructor can test edge cases I haven't seen.
32. As a Student, I want my score expressed as "ได้ X/Y คะแนน" (actual points, not a percentage),
    so that I can relate it to the gradebook.
33. As a Student, I want the "รันทดสอบ" action to run only visible (non-hidden) test cases, so
    that I can sanity-check my code before submitting.

### Instructor review & score override
34. As an Instructor, I want to see a list of submissions per problem, so that I can review
    student work.
35. As an Instructor, I want to open a submission and see the student's code alongside the
    auto-graded result, so that I can judge whether the auto-grade is correct.
36. As an Instructor, I want to override the auto-graded score with a manual score, so that I
    can award partial credit or correct Piston errors.
37. As an Instructor, I want to mark a submission as "ตรวจแล้ว" (reviewed), so that the
    "รอตรวจ" counter decreases.
38. As an Instructor, I want the effective score to be manual_score when set, otherwise
    points_earned, so that overrides take precedence automatically.

### Deleting problems
39. As an Instructor, I want a delete action with a confirmation modal "ต้องการลบโจทย์ X
    ใช่หรือไม่?", so that I can remove problems deliberately.
40. As an Instructor, I want deleting a problem to also remove its test cases and submissions
    (cascade), so that no orphan data remains.

## Implementation Decisions

### Schema additions

Four new tables:

**`weeks`** — `(id, course_id FK→courses, week_no INT, topic TEXT, created_at, updated_at)`;
unique `(course_id, week_no)`. Eight rows are seeded per course in `db:setup` and whenever a
new course is created via the API.

**`problems`** — `(id, course_id FK→courses, week_id FK→weeks, title, description, input_spec,
output_spec, due_at TIMESTAMPTZ NULLABLE, close_at TIMESTAMPTZ NULLABLE, language TEXT DEFAULT
'python', created_at, updated_at)`. `ON DELETE CASCADE` from both `courses` and `weeks`.

**`test_cases`** — `(id, problem_id FK→problems, input TEXT, expected_output TEXT, is_hidden
BOOLEAN DEFAULT FALSE, score NUMERIC DEFAULT 0, sort_order INT DEFAULT 0)`. `ON DELETE CASCADE`
from `problems`.

**`submissions`** — `(id, problem_id FK→problems, user_id FK→users, course_id FK→courses, code
TEXT, language TEXT, points_earned NUMERIC NULLABLE, points_max NUMERIC NULLABLE, is_late BOOLEAN
DEFAULT FALSE, results JSONB NULLABLE, manual_score NUMERIC NULLABLE, reviewed_by INT NULLABLE
FK→users, reviewed_at TIMESTAMPTZ NULLABLE, submitted_at TIMESTAMPTZ DEFAULT now())`.

Effective score = `COALESCE(manual_score, points_earned)`.

### Updated `GradeResult` type

The `score: number // 0-100` field is replaced with `pointsEarned: number` and
`pointsMax: number`. `feedback` is updated to "ได้ X/Y คะแนน" form. `TestResult` gains a `score`
field (the test case's point value) so the per-test breakdown is available to the UI.

### Week seeding

Eight weeks are seeded with default topics ("สัปดาห์ที่ 1" … "สัปดาห์ที่ 8") whenever a course is
created. The `db:setup` script also seeds the weeks for the seed course. Instructors update topics
via a separate week-management UI (edit icon on each WeekBar pill, or an inline edit).

### Two-tier deadline enforcement (ADR 0002)

`/api/grade` checks `close_at` first — returns 403 "submission window closed" if past. Then checks
`due_at` — if past, sets `is_late = true` on the stored Submission. Both fields are optional NULLs.
`close_at` must be ≥ `due_at` when both are set; validated server-side on save.

### Repositories (injectable `Queryable`, mirror existing pattern)

- **`weeks/repository.ts`** — `listWeeks(courseId)`, `updateWeekTopic(id, topic)`. No create/delete
  (weeks are seeded, not user-created).
- **`problems/repository.ts`** — `createProblem`, `getProblemById`, `listProblems(courseId,
  weekId?)`, `updateProblem`, `deleteProblem`. Problem data includes test cases inline for the
  student editor (single query + join).
- **`test_cases/repository.ts`** — `setTestCases(problemId, cases[])` replace-set (mirrors
  `setCourseInstructors`).
- **`submissions/repository.ts`** — `createSubmission`, `listSubmissions(problemId)`,
  `getSubmission(id)`, `reviewSubmission(id, { manualScore, reviewedBy })`,
  `countSubmitted(problemId, courseId)`, `countPending(problemId)`.

### Access control

Same pattern as roster: `authorizeCourse` gate on every `/api/courses/[id]/problems*` and
`/api/courses/[id]/weeks*` route. Instructor/Admin = full CRUD; TA = read-only (GET only).
`/api/grade` is Student-facing: authenticated user must be enrolled in the course.

### API contracts (thin route handlers over repositories)

```
GET  /api/courses/[id]/weeks                  — list all 8 weeks + topics
PUT  /api/courses/[id]/weeks/[wid]            — update week topic (Instructor/Admin)

GET  /api/courses/[id]/problems               — list problems (optionally ?week=N)
POST /api/courses/[id]/problems               — create problem + test cases
GET  /api/courses/[id]/problems/[pid]         — problem detail + test cases
PUT  /api/courses/[id]/problems/[pid]         — update problem + replace test cases
DELETE /api/courses/[id]/problems/[pid]       — delete (cascades test cases + submissions)

GET  /api/courses/[id]/problems/[pid]/submissions         — list submissions (Instructor)
GET  /api/courses/[id]/problems/[pid]/submissions/[sid]   — submission detail + code
PUT  /api/courses/[id]/problems/[pid]/submissions/[sid]   — review: manualScore + mark reviewed

POST /api/grade   — updated: load problem+test cases from DB, enforce deadlines,
                    store Submission, return { pointsEarned, pointsMax, results[], feedback }
```

### UI pages (project patterns — no MUI/framer-motion)

- **`/problems`** — WeekBar (horizontal scroll) + Card with problem table. "เพิ่มโจทย์" button
  top-right. Edit/view/delete row actions. TA sees no mutate controls.
- **`/problems/new`** and **`/problems/[id]/edit`** — ProblemEditor full-page (replaces content
  area, not a modal): two-column grid (main `1fr` / side `300px` sticky, collapses under 1000px).
- **`/problems/[id]`** — Student problem view, loads from DB. Shows due date, late warning if
  past due_at. "รันทดสอบ" runs visible cases; "ส่งคำตอบ" runs all cases and stores Submission.

### Logging

Extend `LogAction` union with: `problem.create | problem.update | problem.delete` (actor = Instructor, target = problem id + title snapshot).

## Testing Decisions

**What makes a good test:** assert external behaviour through a module's public interface. Do not
assert on SQL strings or internal state. Seed through public repository functions; assert on
returned data or HTTP response shape.

**Modules under test:**

- **Week repository** (pg-mem) — `listWeeks` returns 8 rows after seeding; `updateWeekTopic`
  persists; unique constraint on `(course_id, week_no)`.
- **Problem repository** (pg-mem) — create/get/list/update/delete; `listProblems` filters by
  week; delete cascades test_cases; `getProblemById` includes test cases.
- **Test case replace-set** — `setTestCases` replaces all cases atomically; sort_order preserved.
- **Submission repository** (pg-mem) — `createSubmission` stores; `countPending` decrements after
  `reviewSubmission`; `COALESCE(manual_score, points_earned)` logic verified via query.
- **Problem validation** (pure unit) — required fields, `close_at ≥ due_at` when both set,
  score ≥ 0 per test case, at least one test case.
- **`/api/grade` route** (pg-mem integration) — loads problem from DB; 403 after close_at;
  is_late=true after due_at; stores Submission; returns `pointsEarned`/`pointsMax`.
- **`/api/courses/[id]/problems` routes** (pg-mem integration) — 401 unauthenticated, 403 TA
  on mutate, 403 non-entitled Instructor, happy-path CRUD, cascade delete verified.
- **`/api/courses/[id]/problems/[pid]/submissions` routes** — Instructor sees list; student cannot
  list others' submissions; `reviewSubmission` updates reviewed_at.

**Prior art:** `src/lib/courses/repository.test.ts`, `src/lib/enrollments/repository.test.ts`,
`src/app/api/courses/[id]/students/route.test.ts`, `src/app/api/grade/route.test.ts`.

## Out of Scope

- Manual grading UI ("ตรวจงาน" page) — the `reviewed_by/reviewed_at/manual_score` columns are
  seeded in schema now but the full review UI is a separate feature.
- Student gradebook / สมุดคะแนน — depends on Submission data now being stored; the UI is a
  separate feature.
- Per-student deadline extensions.
- Problem reuse across courses (problems are course-scoped in v1).
- Bulk problem import/export (Excel or otherwise).
- Languages other than Python — `language` column exists but Piston call stays Python 3.10.0.
- Numbered full pager (first/…/last) on the problem list — the project uses prev/next pager;
  problem lists are short enough that week-filtering makes pagination unnecessary in v1.
- "ดู" (eye preview) opening a separate read-only view distinct from the editor — in v1 the eye
  and edit actions both open the editor (TA sees a disabled form).

## Further Notes

- `db:setup` must seed 8 weeks for the seed course (`01076021`) in addition to existing Admin seed.
  When the course-creation API runs (`POST /api/courses`), it must also seed 8 weeks for the new
  course atomically in the same transaction.
- The `sort_order` column on `test_cases` lets the editor reorder cases in future without
  schema changes. For v1 it reflects insertion order.
- `results JSONB` on `submissions` stores the full `TestResult[]` array from Piston so the review
  UI can display per-test output without re-running. Schema is the existing `TestResult` shape
  plus a `score` field.
- The existing `Problem` and `TestCase` TypeScript interfaces in `src/types/index.ts` need
  updating: `Problem.id` changes from `string` to `number`, `TestCase` gains `score: number`,
  `GradeResult` replaces `score: number` with `pointsEarned: number` and `pointsMax: number`.
- The old hardcoded `problems` maps in `/problems/[id]/page.tsx` and `/api/grade/route.ts` are
  removed entirely; the DB is the sole source of truth from this feature onward.
