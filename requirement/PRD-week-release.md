# PRD — Week Release Toggle

> CE-Grader — ระบบควบคุมการปล่อยโจทย์รายสัปดาห์
> Feature branch of CE-Grader core
> Domain glossary: `CONTEXT.md` · Architecture decisions: `docs/adr/`

---

## Problem Statement

ปัจจุบัน Instructor ที่สร้างโจทย์ใน Course จะทำให้โจทย์นั้นมองเห็นได้โดยนักศึกษาทันที ไม่มีกลไกที่จะเตรียมโจทย์ไว้ล่วงหน้าแล้วค่อยปล่อยให้นักศึกษาเห็นพร้อมกัน ส่งผลให้ Instructor ต้องรีบสร้างโจทย์ทั้งหมดในคืนเดียวก่อนเปิดเรียน หรือเสี่ยงให้นักศึกษาเห็นโจทย์ที่ยังไม่สมบูรณ์

## Solution

เพิ่ม toggle "ปล่อย/ซ่อน" ระดับ Week ใน WeekBar — Instructor กดปุ่ม lock/unlock บน week card เพื่อสลับสถานะ Week ที่ยัง "ซ่อน" จะมองไม่เห็นจากฝั่งนักศึกษาเลย ทั้งใน assignments, scorebook และ problems page ถ้านักศึกษาพิมพ์ URL ของโจทย์ใน week ที่ซ่อนอยู่โดยตรง จะเห็นหน้า "ยังไม่เปิดรับ" แทนที่จะเป็น 404

## User Stories

1. As an Instructor, I want to create problems in a Week without releasing them to students, so that I can prepare all content in advance before the class starts.
2. As an Instructor, I want to release a Week with a single click, so that all problems in that Week become visible to students simultaneously.
3. As an Instructor, I want to hide a released Week, so that I can pull back content if I discover an error after releasing.
4. As an Instructor, I want to see a lock icon on each unreleased Week card, so that I can tell at a glance which Weeks are visible to students and which are not.
5. As an Instructor, I want unreleased Week cards to look nearly the same as released ones (only a lock icon differs), so that the WeekBar remains uncluttered.
6. As an Admin, I want the same release/hide capability as an Instructor, so that I can manage any Course in the system.
7. As a Student, I want to see only released Weeks in the WeekBar on my Assignments page, so that I am not confused by placeholder or incomplete content.
8. As a Student, I want to see only released Weeks in my Scorebook, so that my score summary reflects only publicly available problems.
9. As a Student, I want to see only released Weeks on the Problems page, so that my view is consistent everywhere in the system.
10. As a Student, when I navigate directly to a URL for a problem in an unreleased Week, I want to see a clear "ยังไม่เปิดรับ" message, so that I understand the content is not yet available rather than thinking the URL is broken.
11. As a TA, I want to see all Weeks (released and unreleased) on the Problems page, so that I can review content before it goes live.
12. As an Instructor, I want newly created Weeks to default to hidden, so that I never accidentally expose incomplete problems.
13. As an Instructor, I want Weeks seeded automatically when a Course is created to default to hidden, so that the same safe default applies everywhere.

## Implementation Decisions

### Schema

Add one column to the `weeks` table:

```sql
ALTER TABLE weeks ADD COLUMN is_released BOOLEAN NOT NULL DEFAULT FALSE;
```

- Default `FALSE` — every Week (existing and new) starts hidden after migration.
- Existing courses: all Weeks will become hidden after deploy. Instructors must manually release Weeks they want students to see. This is an accepted trade-off (chosen over a migration that auto-releases existing rows).
- No `released_at` timestamp in v1 — manual toggle only, no scheduled release.

### Week Repository (`src/lib/weeks/`)

- Add `isReleased: boolean` to `WeekRecord` type and `WEEK_COLS` projection.
- Add `setWeekReleased(db, weekId, isReleased: boolean): Promise<WeekRecord | null>` — updates `is_released` and `updated_at`.
- `listWeeks` gains an optional `releasedOnly?: boolean` parameter — when `true`, adds `AND is_released = TRUE` to the query. All existing callers pass nothing (default: return all).
- `getWeekByNo` also returns `isReleased` so the problem page can gate access.

### Weeks API

**`GET /api/courses/[code]/[year]/[semester]/weeks`**
- Caller role is available via `auth.user.roles`.
- If the caller's active role is **Student**: call `listWeeks(db, course, { releasedOnly: true })`.
- Otherwise (Admin / Instructor / TA): call `listWeeks(db, course)` — return all.
- Response shape gains `isReleased` field on each week object.

**`PUT /api/courses/[code]/[year]/[semester]/weeks/[wid]`**
- Currently accepts `{ topic }`. Extend to also accept `{ isReleased: boolean }`.
- If `isReleased` is present in body (and caller has `manage: true`), call `setWeekReleased`.
- If `topic` is present, call `updateWeekTopic` as before.
- Both fields may be sent together; each is updated independently.
- A request with neither field returns 400.

### Problem Page Gate (`/courses/[code]/[year]/[semester]/problems/[week]/[no]`)

After resolving `weekRecord` via `getWeekByNo`:

- If the caller is **not** privileged (Admin / Instructor / TA) **and** `weekRecord.isReleased === false`: render an inline "ยังไม่เปิดรับ" notice (not `notFound()`). The notice informs the student that the content is not yet available. The page renders within the normal shell (navbar + sidebar visible).
- Privileged callers (staff) always see the problem regardless of release state.

### WeekBar Component

- `Week` interface gains `isReleased: boolean`.
- When `canManage` is true, each week card renders a small lock/unlock icon in the top-right corner of the card (absolutely positioned, same pattern as the existing delete button).
  - Locked icon (🔒) = not released.
  - Unlocked icon = released.
  - Clicking the icon calls `PUT /api/courses/[courseSlug]/weeks/[week.id]` with `{ isReleased: !week.isReleased }`, then triggers `onWeeksChanged()` to re-fetch.
- When `canManage` is false (Student / TA view), no icon is shown. Since hidden weeks are filtered by the API for Students, the icon never appears on student-facing pages.
- The card's visual style (color, size, layout) is unchanged whether the week is released or not — only the lock icon indicates state.

### Student-Facing Pages (Assignments, Scorebook)

Both `AssignmentsList` and `ScoreList` call `GET /api/courses/.../weeks` to populate `WeekBar`. Because the API now filters by role server-side, no changes are needed in these components — Students automatically receive only released Weeks.

### Role Determination in API

The weeks API resolves the caller's role using the existing `auth.user.roles` array from `courseRoute`. The check is: if `roles` contains only `Student` (no staff role), apply the `releasedOnly` filter. If the user has any staff role (Admin / Instructor / TA), return all weeks.

## Testing Decisions

Good tests for this feature verify **external behavior**, not internal implementation details:

- Repository tests: call `setWeekReleased` then `listWeeks` and assert the returned record reflects the new state; verify `releasedOnly` filter returns only released weeks and excludes hidden ones.
- API tests: seed a Week with `is_released = false`; call `GET /weeks` with a Student session and assert the hidden week is absent from the response; call with an Instructor session and assert it is present. Call `PUT /weeks/[wid]` with `{ isReleased: true }` and assert the response week has `isReleased: true`.
- Problem page tests: seed a hidden week and problem; render the page as a Student and assert the "ยังไม่เปิดรับ" notice is present; render as Instructor and assert the full problem content is present.

Prior art for these tests:
- Repository tests: follow `src/lib/weeks/repository.test.ts` — use `freshDb()` + `courseFixture()`.
- API route tests: follow `src/app/api/courses/[code]/[year]/[semester]/assignments/route.test.ts` — use `sessionFor()` with role-specific users and call the route handler directly with a `NextRequest`.

## Out of Scope

- **Scheduled / auto-release**: setting a future timestamp for a Week to release automatically — manual toggle only in v1.
- **Per-problem visibility**: hiding individual Problems within a released Week — Week-level toggle only.
- **Auto-migration of existing data**: existing Weeks are left as `is_released = FALSE`; Instructors release them manually after deploy.
- **Student notification**: no push notification or email when a Week is released.
- **Release history / audit log**: no `LogAction` entry for week release in v1.
- **TA release permission**: TAs remain read-only; only Admin and Instructor can toggle release state.

## Further Notes

- The "ยังไม่เปิดรับ" page renders within the authenticated shell (normal layout), so the student sees familiar navigation. It should display a simple notice with the week name and a back-link to the Problems list.
- After deploy, Instructors of active Courses must release their Weeks before students can access any problems. This is intentional (safe default) but should be communicated as a breaking change when deploying to production.
- The lock icon interaction on WeekBar should be a separate clickable element and must not interfere with the card's existing click-to-select behavior or the double-click-to-edit-topic behavior.
