# PRD 09 · Student — สมุดคะแนนของฉัน (Scorebook)

## Problem Statement

นักศึกษามีหน้า **Assignments** (งานที่ได้รับมอบหมาย) ที่บอกว่าต้องทำโจทย์อะไรบ้างและส่งหรือยัง แต่ยังขาดมุมมองที่ตอบคำถามว่า **"ตอนนี้ฉันได้คะแนนไปเท่าไหร่แล้ว"** อย่างตรงไปตรงมา:

- นักศึกษาต้องคลิกเข้าทีละโจทย์เพื่อดูคะแนน — ไม่มีหน้าสรุปคะแนนรวมของตัวเอง
- ไม่มีภาพรวมเชิงปริมาณ (กี่เปอร์เซ็นต์ของคะแนนเต็ม, ทำไปแล้วกี่ข้อ) ที่ดูแล้วเข้าใจสถานะตัวเองทันที
- หน้า Gradebook ที่มีอยู่เป็นของอาจารย์ (เห็นทุกคน) — นักศึกษาเข้าไม่ได้และไม่ควรเห็นคะแนนคนอื่น

## Solution

เพิ่มหน้า **Scorebook (สมุดคะแนนของฉัน)** สำหรับนักศึกษา — มุมมองคะแนนของ **ตัวเองเท่านั้น** ราย Course แบ่งดูทีละสัปดาห์ผ่าน WeekBar เดียวกับหน้า Assignments แต่ละสัปดาห์มี:

- **Banner สรุป** — วงแหวน progress (donut SVG) แสดง % คะแนนของสัปดาห์ที่เลือก + คะแนนรวม "X / Y คะแนน" + "ทำได้ a จาก b โจทย์"
- **ตารางคะแนน** — รายโจทย์ในสัปดาห์นั้น พร้อมสถานะ คะแนนที่ได้ คะแนนเต็ม และแถวรวมท้ายตาราง

หน้านี้ **อ่านอย่างเดียว** ไม่มีปุ่ม action ไม่มีกำหนดส่ง — โฟกัสที่คะแนนล้วนๆ ทั้ง banner และตารางขยับตามสัปดาห์ที่เลือกใน WeekBar

## User Stories

1. As a Student, I want to open a "สมุดคะแนนของฉัน" page from my sidebar, so that I can see my own scores without clicking into each problem.
2. As a Student, I want the page subtitle to show my student id and name ("{รหัสนักศึกษา} · {ชื่อ}"), so that I am sure I am looking at my own scorebook.
3. As a Student, I want to see only my own scores and never another student's, so that my grades stay private.
4. As a Student, I want a week selector (WeekBar) identical to the one on my Assignments page, so that the two student pages feel consistent and I can focus on one week at a time.
5. As a Student, I want the selected week to persist in the URL (`?week=N`), so that returning via the browser back button lands me on the same week.
6. As a Student, I want a summary banner with a progress ring showing the percentage of points I earned **for the selected week**, so that I get an at-a-glance sense of how I am doing that week.
7. As a Student, I want the banner to show the earned/total points for the week ("X / Y คะแนน") in large text, so that I can read the raw numbers, not just the percentage.
8. As a Student, I want the banner to show "ทำได้ a จาก b โจทย์" for the selected week, so that I know how many of the week's problems I have submitted.
9. As a Student, I want the banner (donut, totals, counts) to update when I switch weeks, so that each week's progress is reported independently.
10. As a Student, I want a table listing each problem in the selected week with an in-week index (ลำดับ = problemNo), so that I can refer to problems by their position within the week.
11. As a Student, I want each row to show the problem title in bold, so that I can identify the problem.
12. As a Student, I want a green "ตรวจแล้ว" badge when my submission has been reviewed, so that I know the score is final.
13. As a Student, I want a blue "ส่งแล้ว · รอตรวจ" badge when I have submitted but the instructor has not reviewed yet, so that I know I am waiting and the shown score is provisional (auto-grade).
14. As a Student, I want a yellow "ยังไม่ส่ง" badge when I have no submission for a problem (including when its close date has passed), so that I know which problems earned me nothing.
15. As a Student, I want the "คะแนนที่ได้" column to show my Effective Score whenever I have a submission (including not-yet-reviewed ones, which show the auto-grade), so that I always see the most current score.
16. As a Student, I want the "คะแนนที่ได้" column to show "–" when I have no submission for a problem, so that an empty score is visually distinct from a zero.
17. As a Student, I want a "เต็ม" column showing each problem's maximum score, so that I know how many points each problem is worth.
18. As a Student, I want a total row at the bottom of the table summing the week's earned and maximum points, so that the table and banner tell a consistent story.
19. As a Student, I want the donut and totals to count the auto-grade of not-yet-reviewed submissions, so that my reported progress reflects all work I have submitted, consistent with the Gradebook and Assignments pages.
20. As a Student, I want a "ยังไม่มีโจทย์ในรายวิชานี้" empty row when the selected week has no problems, so that the table does not look broken.
21. As a Student, I want a 0% donut (not a broken/NaN ring) when a week has no points to earn, so that the empty case renders sensibly.
22. As a Student opening the page without an active Course, I want to be guided to pick a course first, so that I understand why no scores are shown.
23. As an Instructor or Admin, I do not need this page in my own workflow (I have the Gradebook), so the Scorebook lives only in the Student menu.

## Implementation Decisions

### Domain language
- **Scorebook** (สมุดคะแนนของฉัน) — a single Student's own scores across a Course, the single-student counterpart to the staff-facing **Gradebook**. Added to `CONTEXT.md`.
- **Effective Score** — `COALESCE(manual_score, points_earned)`; the one score shown everywhere. A submitted-but-unreviewed problem still has an Effective Score (its auto-grade). Added to `CONTEXT.md`.
- **Gradebook** vs **Scorebook** disambiguated in `CONTEXT.md` — both were colloquially "สมุดคะแนน"; Gradebook is the staff matrix (all students × problems), Scorebook is the student's own.

### Data source — reuse, no new repository or route
- The page reuses the existing **`getStudentAssignments(db, key, userId)`** repository function and its endpoint **`GET /api/courses/.../assignments`** — it already returns every field needed (Effective Score, points max, reviewedAt, submittedAt) and is already scoped to the authenticated user.
- Weeks come from the existing **`GET /api/courses/.../weeks`** endpoint.
- **No new repository, no new API route.** This mirrors the Assignments page's data path.

### Page architecture — client component, mirroring Assignments
- Because the page carries a **WeekBar** with URL-driven week selection, it follows the Assignments pattern: a thin Server Component shell that renders a `'use client'` Scorebook component inside `<Suspense>`.
- The client component fetches weeks + assignments on mount, filters by the active week (`?week=N` via `useSearchParams`/`useRouter`), and reuses the existing **`WeekBar`** component with `canManage={false}` and a no-op `onWeeksChanged`.
- **Decision record:** a pure read-only Server Component (week switching via `<Link href="?week=N">`, no client JS) was considered and is marginally lighter, but reusing the client `WeekBar` was chosen so the week selector stays visually and behaviourally identical to the sibling Assignments page with zero duplication and no drift risk. The cost (two client fetches on a read-only page) is negligible and already the accepted pattern on Assignments.

### Status badge — reuse `deriveAssignmentStatus`
- Reuse the existing pure **`deriveAssignmentStatus(item, now)`** (returns `reviewed | pending | not-submitted | closed`).
- At render, collapse to three badges: `reviewed → ตรวจแล้ว` (green), `pending → ส่งแล้ว · รอตรวจ` (blue), `not-submitted` **or** `closed → ยังไม่ส่ง` (yellow). No new status logic.

### Per-week summary — extracted pure module
- Extract a pure function **`deriveScorebookSummary(weekItems)` → `{ earned, max, percent, solvedCount, totalCount }`** (new module under `src/lib/scorebook/`).
  - `earned` = Σ Effective Score over the week's items, treating null as 0 (counts auto-grade of pending submissions).
  - `max` = Σ points max over **all** the week's problems (including unsubmitted ones).
  - `percent` = `max === 0 ? 0 : Math.round(earned / max * 100)` — guards the 0/0 case.
  - `solvedCount` = number of the week's problems that have a submission; `totalCount` = number of problems in the week.
- The banner and total row both read from this single derivation so they never disagree.

### Score column & empty states
- "คะแนนที่ได้" shows Effective Score when a submission exists, else "–".
- Empty week → table renders a single "ยังไม่มีโจทย์ในรายวิชานี้" row; banner shows 0%.
- No active Course → the page guides the student to select a course (consistent with the Assignments legacy redirector behaviour).

### Table columns
ลำดับ (`problemNo`, in-week) · ชื่อโจทย์ (bold) · สถานะ (badge) · คะแนนที่ได้ · เต็ม — plus a bottom total row (week earned / week max, tinted background).

### Routing & navigation wiring (mirrors Assignments, 5 touch-points)
- Real page at `/courses/[code]/[year]/[semester]/scorebook`.
- Legacy redirector at `/scorebook` (reads `active_course`, redirects to the course-scoped URL; shows "กรุณาเลือกรายวิชาก่อน" when none).
- Add `/scorebook/:path*` to the `proxy.ts` matcher.
- Add a new `MENU` entry (courseScoped) to the **Student** sidebar menu in `roles.ts`, label "สมุดคะแนน".
- Register a new icon key `scorebook` (e.g. `FaChartBar`) in the shell icon registry.

## Testing Decisions

### What makes a good test here
Test external behaviour of pure derivations — given a set of week items, assert the summary numbers and (where reused) the badge state. Do **not** test React rendering, CSS classes, or the donut SVG geometry.

### Modules tested
- **`deriveScorebookSummary` (new, pure)** — unit-tested in isolation with ~4–5 cases:
  - empty week → `{ earned: 0, max: 0, percent: 0, solvedCount: 0, totalCount: 0 }` (no NaN).
  - all reviewed → earned/max and percent correct, `solvedCount === totalCount`.
  - mix including a **pending** submission → its auto-grade is counted in `earned` and the percent.
  - a problem with a null score (no submission) → contributes 0 to `earned`, its points to `max`, and is excluded from `solvedCount`.
  - rounding edge (e.g. 57/70 → 81%).
- **`deriveAssignmentStatus`** is already unit-tested; no new tests — only its existing output is mapped to badges.

### Prior art
- `src/lib/assignments/` — `deriveAssignmentStatus` + its test is the template for a pure, DB-free derivation unit-tested in isolation.
- `src/lib/gradebook/status.ts` (`deriveScorebookStatus`) — same pattern of a pure status/summary derivation.

## Out of Scope

- A pure Server Component implementation (week switching via server-rendered links) — explicitly rejected in favour of reusing the client `WeekBar`.
- A course-wide (all-weeks) total — the banner is intentionally per-selected-week.
- Any new repository function or API route — the page reuses `getStudentAssignments` / `/assignments` and `/weeks`.
- Action buttons, "ทำโจทย์"/"ดูงาน" links, due-date column, late ("ส่งช้า") indicator — those live on the Assignments page; the Scorebook is read-only and score-focused.
- Export (xlsx/PDF) of the student's scorebook.
- Instructor/TA/Admin view of this page — they use the Gradebook; the Scorebook is Student-only.
- Real-time updates when an instructor reviews a submission.

## Further Notes

- Design reference: `requirement/student_score/09-student-scorebook.md` and `requirement/student_score/student-scores.png`. Note the reference omits a week selector; the **week selector is an explicit addition** requested during planning, and consequently the banner became per-week.
- The reference shows only `ตรวจแล้ว` / `ยังไม่ส่ง`; the implemented set is **three** states (adds `ส่งแล้ว · รอตรวจ`) for consistency with the Assignments page and to avoid mislabelling submitted-but-unreviewed work as "ยังไม่ส่ง".
- The donut is a bespoke SVG ring (no chart library — consistent with the project convention of CSS/SVG over chart deps).
- Related ADRs: ADR 0002 (close_at / due_at — only relevant here insofar as a closed unsubmitted problem renders as "ยังไม่ส่ง"), ADR 0003 (Effective Score formula), ADR 0005 (review workbench — source of `reviewed_at`).
- No ADR is warranted for this feature: the decisions are reversible and the domain is already captured in the `CONTEXT.md` glossary additions.
