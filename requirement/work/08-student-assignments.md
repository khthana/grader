# PRD 08 · Student — งานที่ได้รับมอบหมาย (Assignments Page Rebuild)

## Problem Statement

นักศึกษาต้องการดูรายการโจทย์ที่ได้รับมอบหมายในแต่ละสัปดาห์ พร้อมสถานะการส่งงานและคะแนนที่ได้รับ แต่หน้า Assignments ปัจจุบัน:

- แสดงทุกสัปดาห์พร้อมกันโดยไม่มีตัวเลือกสัปดาห์ ทำให้ดูยากเมื่อมีหลายสัปดาห์
- ไม่แยกแยะระหว่าง "ส่งแล้วรอตรวจ" กับ "ตรวจแล้ว" — นักศึกษาไม่รู้ว่าได้คะแนนเท่าไหร่จนกว่าจะคลิกเข้าไป
- Subtitle แสดง code/year/semester แทนชื่อวิชา
- ไม่มีปุ่ม "ทำโจทย์" ที่ชัดเจน — มีแค่ "เปิดโจทย์" เหมือนกันทุก row

## Solution

ปรับหน้า Assignments ให้เป็น **week-scoped view** โดยมี WeekBar ให้นักศึกษาเลือกสัปดาห์ แสดงโจทย์ของสัปดาห์นั้นในรูปตาราง พร้อม status badge 4 สถานะที่ชัดเจน และปุ่ม action ที่แตกต่างตามสถานะ

## User Stories

1. As a Student, I want to see a week selector bar, so that I can focus on problems for a specific week without scrolling through all weeks at once.
2. As a Student, I want the selected week to persist in the URL, so that when I return from the problem page using the browser back button I land on the same week I was browsing.
3. As a Student, I want to see the course name (not the raw course code/year/semester) in the page subtitle, so that I know which course I'm looking at.
4. As a Student, I want to see the week topic in the section header (e.g. "สัปดาห์ที่ 1 · พื้นฐาน Python และ I/O"), so that I know what the week is about.
5. As a Student, I want to see a numbered index (ลำดับ) column for problems within the week, so that I can refer to problems by their in-week position.
6. As a Student, I want to see a green "ตรวจแล้ว · N/M" badge when my submission has been reviewed, so that I know my grade immediately without clicking in.
7. As a Student, I want to see a blue "ส่งแล้ว · รอตรวจ" badge when I have submitted but the instructor has not yet reviewed, so that I know I am waiting for feedback.
8. As a Student, I want to see a yellow "ยังไม่ส่ง" badge when I have not submitted a problem, so that I know which problems still need attention.
9. As a Student, I want to see a red "หมดเวลา" badge when the close date has passed and I have not submitted, so that I know submission is no longer possible.
10. As a Student, I want to see a primary "ทำโจทย์" button for problems I have not yet submitted (and that are still open), so that I can navigate directly to the solve page.
11. As a Student, I want to see an outline "ดูงาน" button for problems I have already submitted, so that I can review my submission and grade.
12. As a Student, I want to see an outline "ดูโจทย์" button for problems that are closed and I did not submit, so that I can still read the problem statement even though submission is no longer possible.
13. As a Student, I want the "คะแนนเต็ม" column to show the maximum score for each problem, so that I know how many points each problem is worth.
14. As a Student, I want the effective score (COALESCE(manual_score, points_earned)) shown inside the "ตรวจแล้ว" badge, so that I see the final score including any instructor adjustment.
15. As a Student, I want to see an empty state row "ยังไม่มีงานในสัปดาห์นี้" if the selected week has no problems, so that the table does not appear broken.

## Implementation Decisions

### Modules to build / modify

**1. Repository — `src/lib/assignments/repository.ts`**
- Add `reviewedAt: string | null` to the `AssignmentSubmission` interface.
- Extend the submission sub-query to also select `reviewed_at` from the `submissions` table.
- No schema change — `reviewed_at` already exists in the `submissions` table.

**2. Server page — `src/app/(app)/courses/[code]/[year]/[semester]/assignments/page.tsx`**
- Call `getCourseByKey(db, slug)` server-side to obtain `nameTh`.
- Read `searchParams.week` (async, Next 16 pattern) and pass `initialWeek` as a prop to the client component.
- Pass `courseName` (= `"${code} · ${nameTh}"`) as a prop so the page header renders correctly server-side.
- Wrap `AssignmentsList` in `<Suspense>` (required because `useSearchParams()` is used client-side).

**3. Client component — `src/components/assignments/AssignmentsList.tsx`**
- Convert to URL-param-driven week selection using `useSearchParams()` + `useRouter()`.
- Fetch weeks from `GET /api/courses/{slug}/weeks` on mount (existing endpoint, no change needed).
- Fetch all assignments from `GET /api/courses/{slug}/assignments` on mount (existing endpoint, no change needed).
- Filter assignments client-side by active `weekNo` — no per-week API call.
- Render `WeekBar` (existing component from `src/components/problems/WeekBar.tsx`) with `canManage={false}` and a no-op `onWeeksChanged`.
- **Status badge logic (4 states, evaluated at render time):**
  - `submission && submission.reviewedAt` → **ตรวจแล้ว · {effectiveScore}/{pointsMax}** (green)
  - `submission && !submission.reviewedAt` → **ส่งแล้ว · รอตรวจ** (blue)
  - `!submission && isClosed` → **หมดเวลา** (red), where `isClosed = closeAt && new Date(closeAt) < now`
  - `!submission && !isClosed` → **ยังไม่ส่ง** (yellow)
- **Action button logic:**
  - `submission` (any) → "ดูงาน" outline link → `{coursePath}/problems/{weekNo}/{problemNo}`
  - `!submission && isClosed` → "ดูโจทย์" outline link → same path
  - `!submission && !isClosed` → "ทำโจทย์" primary link → same path
- **Table columns:** ลำดับ (`problemNo`) / ชื่อโจทย์ / กำหนดส่ง / คะแนนเต็ม / สถานะ / action
- Drop the existing `ScoreBadge` sub-component (score is now in the status badge).
- Drop "ส่งช้า" state — not in spec, redundant with reviewed/pending distinction.

### URL state
Active week lives in `?week=N` query param. Default: week 1 (or the `initialWeek` prop passed from the server). `useRouter().push(`?week=${n}`)` on week change.

### No new API routes
Both `/weeks` and `/assignments` endpoints already exist and return sufficient data. No backend route changes required.

### WeekBar reuse
`WeekBar` accepts `canManage: boolean`. Passing `canManage={false}` hides all add/delete/edit controls, leaving a pure navigation bar. Pass `onWeeksChanged={() => {}}` as a no-op.

## Testing Decisions

### What makes a good test here
Test repository behavior (what the DB query returns) and pure badge/button logic (given an `AssignmentItem`, what state is derived). Do not test React rendering or CSS classes.

### Modules to test

**Repository (`src/lib/assignments/repository.ts`)**
- Verify that `reviewedAt` is returned as `null` for an unreviewed submission and as a timestamp string after `reviewSubmission` is called.
- Prior art: `src/lib/assignments/repository.test.ts` already covers the basic flow; extend it with a `reviewedAt` assertion.

**Badge/button logic (pure function, extracted)**
- Extract status-derivation into a pure function `deriveAssignmentStatus(item: AssignmentItem, now: Date): AssignmentStatus` that returns one of `"reviewed" | "pending" | "not-submitted" | "closed"`.
- Unit-test all 4 branches including edge cases: `closeAt` exactly equal to `now`, `closeAt` null with no submission.
- Prior art: `src/lib/gradebook/` has `deriveScorebookStatus` — same pattern of a pure, DB-free derivation unit-tested in isolation.

## Out of Scope

- Sorting or filtering problems within a week.
- Pagination of assignments.
- The "Solve" (ทำโจทย์) page itself — that is handled by the existing problem page (`/problems/[week]/[no]`) and `CodeEditor` component.
- Push notifications or real-time updates when an instructor reviews a submission.
- Late submission indicator — "ส่งช้า" is intentionally excluded from the badge set.
- Instructor or TA view of this page — the page is Student-only (any non-student who navigates here sees it under their student role only).

## Further Notes

- The `WeekBar` component's `canManage={false}` path has not previously been exercised in the assignments context; verify visually that the topic line renders correctly for students (topic shown read-only, no double-click edit).
- `closeAt` and `dueAt` are already present in `AssignmentItem`; no repository query change is needed for the closed-state check.
- The effective score formula — `COALESCE(manual_score, points_earned)` — is already computed as `effectiveScore` in the repository and should be used directly in the badge; do not re-derive it on the client.
- Design reference: `requirement/student_work/08-student-work-solve.md`, `requirement/student_work/student-work.png`.
- Related ADRs: ADR 0002 (two-tier deadline — `close_at` / `due_at` semantics), ADR 0003 (effective score formula).
