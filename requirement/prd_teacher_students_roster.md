# PRD — Teacher Course Management & รายชื่อนักศึกษา (Roster)

> Source mockup: `requirement/student/05-teacher-students.md`, `student.jsx`,
> `teacher-students.png`. Domain glossary: `CONTEXT.md`. Decision record:
> `docs/adr/0001-course-scoped-roster.md`. Directive: when the project's design
> conflicts with the mockup, the project's patterns win.

## Problem Statement

An Instructor (the mockup's "Teacher") has no way to manage who is in their course.
Today the only roster-like tool is Admin **User Management**, which lists *all* users
globally — it has no concept of a course, no group/program/year, and isn't something a
teacher should use to add the students sitting in their section. A teacher needs to
open *their* course and see, search, add, edit, remove, import (from Excel), and export
the students enrolled in it — without touching anyone else's course or the global user
directory. The `/students` page is currently a "coming soon" stub and the navbar course
switcher is decorative.

## Solution

Introduce a real **Course** domain and make `/students` show the **Roster** (รายชื่อ
นักศึกษา) of the currently-selected Course.

- A **Roster** entry is an **Enrollment** linking a **Student** (a User with the Student
  role) to a **Course**. Course-local fields — **Group**, **Program**, **Year** — live
  on the Enrollment; the User keeps only identity (sid/`id_code`, prefix, first/last).
- Teachers select their course from the navbar switcher (persisted in an
  `active_course` cookie). They see only courses they're entitled to.
- On the roster they can search, filter by group, page through 10 at a time, add a
  student, edit a row, remove (un-enroll) a row, **import from Excel**, and **export to
  Excel**.
- A new **`/courses`** page lets Admin/Instructor create, edit, and delete courses and
  assign instructors/TAs.
- Adding/importing a student **finds-or-creates** the User by `id_code` (deriving
  `{sid}@kmitl.ac.th` when no email is given) so enrolled students can log in and submit
  code — reusing the project's single identity model, validation, bcrypt, and the
  client-side xlsx import patterns.

The page is styled with the project's existing shell, table, dialog, toast, and simple
prev/next pager conventions rather than the mockup's bespoke styling.

## User Stories

### Course selection & access
1. As an Instructor, I want to pick my course from the navbar switcher, so that the page shows that course's roster.
2. As an Instructor, I want my selected course remembered across navigation and reloads, so that I don't re-select it every time.
3. As an Instructor, I want to see only the courses I'm assigned to, so that I'm not exposed to other teachers' courses.
4. As an Admin, I want to see and open every course, so that I can support any class.
5. As a TA, I want to open the rosters of courses I'm assigned to, so that I can review who's enrolled.
6. As an Instructor with no assigned courses, I want a clear empty state (with a create-course prompt), so that I know what to do next instead of seeing a broken page.
7. As a Student, I want no access to the roster page, so that course management stays with teachers.

### Viewing the roster
8. As an Instructor, I want a table of students (running number, รหัสนักศึกษา, คำนำหน้า, ชื่อ-นามสกุล, หลักสูตร, กลุ่ม, ปีการศึกษา), so that I can read my class list at a glance.
9. As an Instructor, I want to search by รหัส / ชื่อ / นามสกุล, so that I can find a student quickly.
10. As an Instructor, I want to filter by group (ทุกกลุ่ม / each group present), so that I can focus on one section.
11. As an Instructor, I want 10 rows per page with prev/next paging, so that large classes stay readable.
12. As an Instructor, I want search/filter changes to reset me to page 1, so that I don't land on an empty page.
13. As an Instructor, I want a friendly "ไม่พบนักศึกษาที่ค้นหา" row when nothing matches, so that I know the search ran.
14. As an Instructor, I want a "ทั้งหมด N คน" count, so that I know my class size.

### Adding a student
15. As an Instructor, I want an "เพิ่มนักศึกษา" button opening a form (รหัส*, คำนำหน้า, ชื่อ*, นามสกุล*, กลุ่ม, ปีการศึกษา, หลักสูตร optional, email optional), so that I can enroll one student.
16. As an Instructor, I want a blank email to auto-derive `{sid}@kmitl.ac.th`, so that quick entry still creates a login-capable account.
17. As an Instructor, I want a blank หลักสูตร to inherit the course's default program, so that I don't retype it for every student.
18. As an Instructor, when the รหัส belongs to an existing user, I want them reused (not duplicated) and just enrolled, so that one person has one account across courses.
19. As an Instructor, when the existing user already has a name, I want it kept (not overwritten by my entry), so that data edited elsewhere isn't clobbered.
20. As an Instructor, when I try to add a รหัส already in this course, I want a clear "รหัสนี้อยู่ในรายวิชาแล้ว" rejection, so that I don't create duplicate roster rows.
21. As an Instructor, I want the new student to automatically gain the Student role, so that they can log in and submit code.

### Editing a student
22. As an Instructor, I want an edit (pen) action per row opening a prefilled form, so that I can correct a student's details.
23. As an Instructor, I want to change group/program/year (enrollment) from the edit form, so that I can fix course-local data.
24. As an Instructor, I want to fix a student's prefix/first/last name from the edit form, understanding it updates their shared profile, so that typos can be corrected here.
25. As an Instructor, I want รหัสนักศึกษา shown read-only on edit, so that I can't accidentally break the identity key or collide with another user.

### Removing a student
26. As an Instructor, I want a delete (trash) action with a confirm "ลบ ชื่อ (รหัส) ออกจากรายวิชา?", so that I can remove a student from my course deliberately.
27. As an Instructor, I want delete to un-enroll only (keep the user account and their other-course enrollments), so that removing them from my class doesn't wipe them from the system.

### Excel import
28. As an Instructor, I want a "นำเข้า Excel" button opening an import dialog, so that I can add a whole class at once.
29. As an Instructor, I want a drag-and-drop dropzone (with drag-over and file-selected states), so that uploading the sheet is easy.
30. As an Instructor, I want a downloadable template, so that I know the expected columns (รหัส, คำนำหน้า, ชื่อ, นามสกุล, กลุ่ม, ปีการศึกษา, หลักสูตร, email).
31. As an Instructor, I want a preview table of parsed rows with "พบ N รายชื่อ", so that I can sanity-check before committing.
32. As an Instructor, I want invalid rows flagged per-row without blocking the valid ones, so that one bad line doesn't fail the whole import.
33. As an Instructor, I want within-sheet duplicate รหัส flagged, so that I don't enroll the same person twice.
34. As an Instructor, I want imported rows to find-or-create users and enroll them into the current course (deriving email and inheriting course program as in single-add), so that import follows the same rules as the form.
35. As an Instructor, I want a per-row result summary after import (created / enrolled / skipped-duplicate / error), so that I know what happened.

### Excel export
36. As an Instructor, I want a "ส่งออก" button, so that I can download my roster.
37. As an Instructor, I want export to include the full filtered roster (all matching rows, every page — not just the visible page), so that I get the complete list I'm looking at.

### Course management (/courses)
38. As an Instructor, I want a /courses page listing my courses, so that I can manage them in one place.
39. As an Instructor, I want to create a course (code, ชื่อไทย, ชื่ออังกฤษ, default program), so that I can set up a new class.
40. As an Instructor, I want to edit a course's details, so that I can fix its name or default program.
41. As an Instructor, I want to delete a course, so that I can remove a class I no longer teach (with its enrollments).
42. As an Admin, I want to assign instructors/TAs to a course, so that the right people can manage it.
43. As an Admin, I want to see all courses on /courses, so that I can administer any class.
44. As an Instructor, I want a quick "＋ เพิ่มรายวิชา" shortcut in the navbar switcher, so that I can create a course without leaving my current page.
45. As a TA, I want NOT to be able to create/delete courses or assign instructors, so that course structure stays with Instructors/Admin.
46. As a TA, I want the roster shown read-only (no add/edit/delete/import controls), so that I don't accidentally change my supervisor's class.

### Auditing
47. As an Admin, I want course create/edit/delete and enroll/un-enroll/import actions logged, so that I can audit who changed a roster.

## Implementation Decisions

### Domain & schema (see ADR 0001)
- **`courses`**: `id`, `code` (unique), `name_th`, `name_en`, `program` (default program), `created_at`, `updated_at`.
- **`course_instructors`**: `(course_id, user_id)` PK linking a Course to a User. Whether that user acts as Instructor or TA is read from their **global role** — no per-course capacity column in v1.
- **`enrollments`**: `id`, `course_id`, `user_id`, `group`, `program`, `year`, `created_at`; **unique `(course_id, user_id)`**. All course-local roster fields live here.
- A **Student is a User** with the Student role; there is no separate roster-only table. Identity (`id_code`, prefix, first/last) stays on `users`.

### Identity, add & import behavior
- **Find-or-create by `id_code`**: no match → create user + assign Student role + enroll; match → reuse user (ensure Student role), **do not overwrite name**, add enrollment; already enrolled in this course → reject as duplicate.
- **Email**: optional in form/import; blank → derive `{id_code}@kmitl.ac.th`.
- **Program**: blank → inherit the course's default `program`.
- **Delete = un-enroll** (remove the enrollment row only).
- **Edit** = enrollment fields (group/program/year) + shared user name/prefix; `id_code` read-only.

### Access control
- Admin → all courses (roster CRUD + course management).
- Instructor → roster CRUD + course management, scoped to assigned courses.
- TA → roster **view-only**, scoped to assigned courses.
- Student → no access.
- Authorization enforced server-side in every API route; the navbar switcher and list endpoints only return entitled courses.
- Selected course persists in an **`active_course` cookie**, mirroring the existing `active_role` pattern; a default is resolved server-side; an empty state covers users with no entitled courses.

### Modules to build (deep modules with simple, testable interfaces)
1. **Course repository** (`src/lib/courses/repository.ts`) — `createCourse`, `listCourses`, `getCourse`, `updateCourse`, `deleteCourse`, `assignInstructor` / `setCourseInstructors`, `listCoursesForUser` (entitlement). Takes an injectable `Queryable`, like `users/repository.ts`.
2. **Enrollment repository** (`src/lib/enrollments/repository.ts`) — `listEnrollments` (course-scoped: search + group filter + pagination → `{ rows, total }`), `createEnrollment`, `updateEnrollment`, `deleteEnrollment`, `findEnrollment`, `listGroups` (distinct groups in a course).
3. **Enroll service** (`src/lib/enrollments/enroll.ts`) — orchestrates find-or-create-by-`id_code`, email derivation, course-default program, Student-role assignment, duplicate rejection. Returns a typed per-student result.
4. **Roster import validation** (`src/lib/enrollments/import.ts`, pure) — `validateRosterRows`: normalize cells, map roster columns, within-sheet duplicate-`id_code` detection, reuse field validation. Mirrors `users/import.ts`.
5. **Course access/entitlement** (`src/lib/courses/access.ts`, pure) — `canManageRoster(role, isAssigned)`, `canManageCourse(role, isAssigned)`, `resolveActiveCourse(courses, requested?)`. Mirrors `roles.ts`.

### API contracts (route handlers — thin over the modules)
- `GET/POST /api/courses` — list entitled courses / create (Admin+Instructor).
- `GET/PUT/DELETE /api/courses/[id]` — detail / edit / delete (Admin+Instructor, entitled).
- `PUT /api/courses/[id]/instructors` — assign instructors/TAs (Admin+Instructor).
- `GET /api/courses/[id]/students` — roster list `{ enrollments, total, page, pageSize }` (search + group filter).
- `POST /api/courses/[id]/students` — add/enroll one (find-or-create).
- `PUT/DELETE /api/courses/[id]/students/[enrollmentId]` — edit / un-enroll.
- `POST /api/courses/[id]/students/import` — bulk enroll, per-row results.
- Every route is role- and entitlement-gated; TA is read-only on roster routes.

### UI (project patterns)
- `/students` — client roster table styled like `UsersTable`; simple prev/next pager, 10/page, reset-to-page-1 on filter change; group filter from distinct course groups; search over `id_code` + name.
- Dialogs — `StudentFormDialog` (add/edit), `RosterImportDialog` (reusing dropzone/parse/preview/template machinery), `ConfirmDialog` for un-enroll.
- `/courses` — `CoursesTable` + `CourseFormDialog` + instructor-assignment UI; new sidebar item for Admin/Instructor.
- Navbar course switcher reads entitled courses, sets `active_course`, offers "＋ เพิ่มรายวิชา".

### Activity logging
- Extend the existing `user_logs` action vocabulary (via `safeLog`) with `course.create | course.update | course.delete | enrollment.add | enrollment.remove | enrollment.import`.

## Testing Decisions

**What makes a good test here:** assert *external behavior* through a module's public
interface, not internal SQL or component structure. Repositories are exercised against
**pg-mem** (in-memory Postgres, no Docker) by seeding through the public functions and
asserting on returned data; pure modules are called directly with inputs and asserted on
outputs; route handlers are imported and invoked with a `NextRequest` carrying a real
`createSessionToken` cookie. Prior art: `src/lib/roles.test.ts`,
`src/lib/users/validation.test.ts`, `src/lib/users/import.test.ts`, and the existing
user repository + `/api/users` route integration tests (the `setTestDb` + `newDb()` +
`mem.public.none(schema.sql)` + `mem.adapters.createPg()` seam).

**Modules under test (all of the below):**
- **Course repository** — create/list/get/update/delete; `assignInstructor`/`setCourseInstructors`; `listCoursesForUser` returns only entitled courses; delete cascades enrollments.
- **Enrollment repository** — `listEnrollments` search + group filter + pagination + total; unique `(course_id, user_id)` rejects re-enroll; `listGroups` distinct; update/delete.
- **Enroll service** — find-or-create-by-`id_code` (new vs existing user), email derivation when blank, course-default program inheritance, name-not-overwritten, Student-role ensured, duplicate-in-course rejection.
- **Roster import validation** — column mapping, required-field errors per row, within-sheet duplicate `id_code` detection, good rows unaffected by bad ones.
- **Course access/entitlement** (pure) — `canManageRoster`/`canManageCourse` truth table across Admin/Instructor/TA/Student × assigned/not; `resolveActiveCourse` default + requested-id resolution + empty list.
- **Route integration tests** (pg-mem) — `/api/courses*` and `/api/courses/[id]/students*`: auth required (401), entitlement enforced (403 for non-assigned Instructor, TA blocked from mutating roster, TA/Student blocked from course management), happy-path CRUD, import per-row results, un-enroll leaves the user intact.

## Out of Scope

- Per-course capacity column (Instructor-vs-TA *within* a course) — capacity is read from the global role in v1.
- Editing `id_code` / merging student accounts.
- Bulk course operations, course archiving, term/semester modeling, or copying a roster between courses.
- Student-facing course enrollment/self-registration.
- Gradebook, assignments, review, and the Python editor (separate features); this PRD only wires the roster, not what depends on it.
- Reworking Admin User Management; it remains the place to fully delete users.
- The mockup's full numbered pager (first/…/last) — superseded by the project's prev/next pager per the directive.

## Further Notes

- Two paths now create users (Admin import and teacher enroll); both converge on a
  single `users` row keyed by email/`id_code`. Keep the find-or-create matching coherent
  between them.
- `id_code` becomes a de-facto matching key for students. The enroll service must guard
  the null/blank `id_code` case (legacy staff users) rather than matching on it.
- Seed at least one course (the screenshot's `01076021 · โครงสร้างข้อมูลและอัลกอริทึม`)
  in `npm run db:setup` so a fresh environment isn't empty.
- The course switcher is shared shell state; future feature pages (ตรวจงาน, สมุดคะแนน,
  งานที่ได้รับมอบหมาย) are expected to read the same `active_course`.
