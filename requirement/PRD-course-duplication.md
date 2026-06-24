# PRD — Course Offering Duplication (คัดลอกวิชาข้ามภาคการศึกษา)

> CE-Grader — คัดลอกเนื้อหาทั้งวิชา (โจทย์ + เฉลย + test cases) จากภาคการศึกษาหนึ่งไปยังภาคใหม่ในคลิกเดียว
> Domain glossary: `CONTEXT.md` · Architecture decisions: `docs/adr/`

---

## Problem Statement

Instructor ที่สอนวิชาเดิมซ้ำในภาคการศึกษาถัดไป (รหัสวิชาเดิม แต่ `year`/`semester` ใหม่) ต้องสร้างโจทย์ใหม่ทั้งหมดตั้งแต่ต้น — ทั้ง weeks, โจทย์, input/output spec, test cases (รวม hidden), code policy และ **เฉลยอ้างอิง (reference solution)** — ทั้งที่เนื้อหาเหมือนภาคก่อนแทบทุกอย่าง เป็นงานซ้ำซ้อนที่ใช้เวลามากและเสี่ยงพิมพ์ผิด/ตกหล่น โดยเฉพาะ test cases และเฉลยที่ verify มาแล้ว

ปัจจุบันระบบ**ไม่มีกลไก clone/duplicate ใดๆ** — offering ใหม่ทุกตัวต้องเริ่มจาก 6 weeks ว่างเปล่า

## Solution

เพิ่มปุ่ม **"ทำซ้ำไปภาคใหม่"** ในแต่ละแถวของหน้า รายวิชา (`/courses`) — Instructor/Admin กดที่ offering ต้นทาง แล้วระบุแค่ **ปี + ภาคการศึกษาปลายทาง** ระบบจะสร้าง offering ใหม่ของวิชาเดียวกันให้ทันที พร้อมคัดลอกเนื้อหาทั้งหมดมาให้: weeks (หัวข้อ), โจทย์ทุกข้อ (ทุก field รวมเฉลย), test cases ทุกเคส และทีมผู้สอน

offering ปลายทางถูกสร้างใหม่และว่างเสมอ (ถ้าปี/ภาคนั้นมีอยู่แล้วจะ error) ทำให้การ map week ตรงไปตรงมาไม่ต้อง merge ส่วนข้อมูลที่ผูกกับปฏิทินภาคเรียน (กำหนดส่ง/ปิดรับ และสถานะปล่อย week) จะถูก **reset** เพื่อให้ภาคใหม่เริ่มจากกระดานเปล่า — Instructor ตั้งวันและเปิด week เองเมื่อพร้อม

## User Stories

1. As an Instructor, I want to duplicate an entire course offering to a new semester in one click, so that I don't have to recreate every problem from scratch when I teach the same course again.
2. As an Instructor, I want a "ทำซ้ำไปภาคใหม่" action on each course row in the รายวิชา page, so that the source offering is unambiguous (the row I clicked).
3. As an Instructor, when I duplicate, I want to specify only the target year and semester, so that the operation is quick and the course identity is inferred from the source.
4. As an Instructor, I want the new offering's name (Thai/English) and program to be copied verbatim from the source, so that it is recognizably the same course; I can edit them later via the existing edit dialog.
5. As an Instructor, I want every Week's number and topic copied, so that the weekly structure of the new offering matches the previous one.
6. As an Instructor, I want all problems copied with their title, description, input/output spec, score, language, and policy lists (blacklist/whitelist), so that the new offering is immediately complete.
7. As an Instructor, I want the **reference solution** of every problem copied, so that I can re-run "รันเฉลย" to verify test cases without rewriting solutions.
8. As an Instructor, I want unit-test-mode fields (`problem_type`, `function_name`, `starter_code`, `unit_test_code`) copied, so that unit-test problems work identically in the new offering.
9. As an Instructor, I want all test cases copied — including hidden ones, their per-case scores, and sort order — so that grading behaves exactly as before.
10. As an Instructor, I want the teaching team (course instructors) copied to the new offering, so that my co-instructors keep access without re-assignment.
11. As an Admin who is not on the source teaching team, when I duplicate an offering, I want to be assigned to the new offering automatically, so that I never create an orphaned offering I cannot manage.
12. As an Instructor, I want deadlines (`due_at`/`close_at`) cleared in the new offering, so that copied problems are not immediately past-deadline from the old calendar.
13. As an Instructor, I want every Week in the new offering to default to hidden (`is_released = false`), so that I control when students see the new term's content.
14. As an Instructor, I want student enrollments NOT copied, so that the new offering starts with the correct (new) cohort.
15. As an Instructor, I want past submissions, manual scores, and review data NOT copied, so that the new offering has a clean gradebook.
16. As an Instructor, when the target year/semester already exists for this course code, I want a clear error, so that I never accidentally overwrite an offering already in use.
17. As an Instructor, I want the duplication to be all-or-nothing, so that a failure midway never leaves a half-copied offering.
18. As an Instructor, I want the new offering to appear in the navbar course switcher and the รายวิชา table immediately after duplication, so that I can jump into it right away.
19. As a Student, I want the reference solution to never be exposed during duplication, so that solutions remain staff-only (it is read and written entirely server-side).
20. As a TA, I want duplication to be unavailable to me (manage-gated), so that the action stays with Instructors and Admins, consistent with course management.
21. As an Instructor, I want problem numbering (`problem_no`) within each week preserved, so that "ข้อ N" references match the source offering.

## Implementation Decisions

### No schema changes

The feature reuses existing tables (`courses`, `course_instructors`, `weeks`, `problems`, `test_cases`) and the existing staff-only `getReferenceSolution` reader. **No migration is required.**

### Entry point (UI)

- Add a "ทำซ้ำไปภาคใหม่" row action (e.g. a copy icon) to `CoursesTable`, alongside the existing ผู้สอน / แก้ไข / ลบ actions, visible when the user can manage courses.
- Clicking opens a small dialog (new `CourseDuplicateDialog`) that collects **only** the target `year` and `semester`. The source `{ code, year, semester }` comes from the clicked row; name/program are not shown for editing (copied verbatim).
- On success, the table reloads and `router.refresh()` updates the navbar course switcher, matching the existing reload pattern in `CoursesTable`.

### API contract

- New route: `POST /api/courses/[code]/[year]/[semester]/duplicate`, wrapped with `courseRoute({ manage: true }, …)`. The slug identifies the **source** offering; `authorizeCourse` enforces source entitlement + manage role.
- Request body: `{ year: number, semester: number }` — the **target** offering.
- Validation:
  - `semester ∈ {1, 2, 3}` and a valid Thai Buddhist `year` (reuse `courses/validation`).
  - Reject if the target `(code, year, semester)` already exists → conflict error (e.g. 409). Target must not pre-exist.
  - Reject target equal to source.
- Success: 201 with the target course key/slug so the client can navigate or refresh.

### Orchestration (single transaction)

A new module-level function, recommended name `duplicateCourseOffering(db, sourceKey, targetKey, actorId)`, performs the copy. It runs inside **one pg transaction** (BEGIN/COMMIT/ROLLBACK via a pooled client passed as the `Queryable`) so the operation is atomic. Steps, in order:

1. **Course:** read source via `getCourseByKey`; create target via `createCourse` copying `nameTh`, `nameEn`, `program`.
2. **Instructors:** `listCourseInstructors(source)` → `setCourseInstructors(target, union(sourceInstructorIds, actorId))`. The acting user is always included.
3. **Weeks:** mirror the source's **actual** week set (which may exceed the default 6) — do **not** call `seedWeeks`. For each source week ordered by `week_no`, insert a target week with the same `week_no` and `topic`, and `is_released = false`. Keep a `sourceWeekId → targetWeekId` map.
4. **Problems:** for each source problem ordered by `(week_no, problem_no)`, read its reference solution via `getReferenceSolution`, then `createProblem` into the mapped target week with all copied fields (`title`, `description`, `input_spec`, `output_spec`, `score`, `language`, `problem_type`, `function_name`, `starter_code`, `unit_test_code`, `blacklist`, `whitelist`, `referenceSolution`) and `dueAt = null`, `closeAt = null`. Copying in ascending `problem_no` order reproduces identical `problem_no` via the existing auto-assign.
5. **Test cases:** for each created problem, `setTestCases` with the source's cases copied 1:1 (`input`, `expected_output`, `is_hidden`, `score`, `sort_order`).

### Explicitly reset / excluded

- `due_at`, `close_at` → `null`.
- `is_released` → `false` (hidden) for every copied week.
- **Not copied:** `enrollments`, `submissions` (and their `manual_score` / `reviewed_*`), any per-student runtime data.

### Reference solution security

The reference solution is read with the existing staff-only `getReferenceSolution` and written via `createProblem`'s `referenceSolution` parameter — entirely server-side within the route handler. It is never placed in a client-reachable projection, preserving the invariant that students cannot read it (per the Reference Solution feature).

## Testing Decisions

Good tests assert **external behavior** — the resulting database state and HTTP responses — not query structure or internal call order. Follow the existing pg-mem integration pattern (`newDb()` + `schema.sql` + `setTestDb`, seeded through repositories; routes invoked with a real `NextRequest` and `createSessionToken` cookie).

**Repository / orchestration tests** (`duplicateCourseOffering` against pg-mem, building on `courseFixture()`):

- Seed a source offering with multiple weeks (including a topic and a week beyond the default 6), problems across weeks (mixing `io` and `unit` types), per-problem reference solutions, blacklist/whitelist, and test cases including hidden ones with distinct scores and sort orders.
- Assert the target course exists with copied `nameTh`/`nameEn`/`program`.
- Assert weeks mirrored: same count, `week_no`, `topic`, and every `is_released = false`.
- Assert problems copied: all fields including reference solution (read back via `getReferenceSolution`), `due_at`/`close_at` null, `problem_no` preserved per week, unit-mode fields intact.
- Assert test cases copied 1:1 including hidden flag, score, and sort order.
- Assert `course_instructors` = source instructors ∪ actor.
- Assert `enrollments` and `submissions` are NOT copied to the target.
- Assert conflict when the target offering already exists (no partial write — atomic rollback leaves the target untouched).

**Route tests** (`POST …/duplicate`):

- 401 without a session; 403 for a Student/TA (manage gating) and for a user not entitled to the source; 404 when the source offering does not exist.
- 409 (conflict) when the target `(code, year, semester)` already exists.
- 400 for invalid body (bad `semester`, invalid `year`, or target equal to source).
- 201 on success, returning the target slug; a follow-up read shows the copied content.

Prior art: existing `src/app/api/courses/**/route.test.ts`, repository tests under `src/lib/courses` and `src/lib/problems`, and `courseFixture()` in `src/lib/test-support/db.ts`.

## Out of Scope

- **Copying into an existing offering** (merge/append). The operation only creates a fresh target; filling an existing offering is not supported.
- **Selective copy** — choosing specific weeks or problems to copy. It is all-or-nothing for the whole offering.
- **Cross-course-code copy** (copying into a different `code`). Source and target share the same course code.
- **Date shifting** — automatically translating old deadlines to the new term's calendar. Deadlines are cleared, not shifted.
- **Copying enrollments / students / submissions / review data.**
- **Bulk duplication** of multiple offerings at once.

## Further Notes

- Because problems are created in ascending `problem_no` order into freshly seeded weeks, the existing `createProblem` auto-assignment reproduces identical numbering — no need to set `problem_no` explicitly.
- The transaction requires passing a single pooled client as the `Queryable` to all repository calls; the repositories already accept any `Queryable`, so no signature changes are needed. If a transaction helper does not yet exist, introduce a minimal one at the route/service layer.
- This PRD was synthesized from a `/grill-me` design session. Resolved decisions: (1) the operation creates the target offering; (2) trigger is a row action in `CoursesTable` asking only target year/semester; (3) deadlines and release state reset; (4) instructors copied + actor unioned; (5) the copy manifest above was confirmed complete.
- No issue tracker is configured in this repo, so this PRD is published as a file under `requirement/` alongside the other PRDs rather than to an external tracker.
