# 1. Course-scoped student roster over a courses/enrollments model

Date: 2026-06-16

## Status

Accepted

## Context

The teacher-facing รายชื่อนักศึกษา page (requirement `05-teacher-students.md`)
manages "students in a course": add/edit/remove, Excel import, search, group filter,
pagination. The screenshot also shows a course switcher in the navbar.

The project, until now, had **no course concept**. Identity is a single global
`users` table with a many-to-many `user_roles` (Admin/Instructor/TA/Student); "a
student is a user with the Student role." Admin User Management already does
table+search+pagination+create/edit/delete+Excel-import over that table.

So we had a fork: build the roster as a *global* Student list reusing the existing
`users` infrastructure (cheap, no new domain), or introduce a genuine
**course-scoped** model (courses + enrollments) as the requirement describes.

The directive was "when the project's design conflicts with the requirement/mockup,
prefer the project." That settles *styling* (Tailwind, existing shell, simple pager,
reuse import patterns) but not the data model — the project simply had no opinion
there because courses didn't exist.

## Decision

Build the course-scoped model, and go further than the roster page alone:

- **`courses`** — `id`, `code` (unique), `name_th`, `name_en`, default `program`,
  timestamps. Managed via a new **`/courses`** page (Admin + Instructor): create /
  edit / delete + assign instructors. Quick "add course" from the navbar switcher.
- **`course_instructors`** — links a Course to a User. Whether that user acts as
  Instructor or TA is read from their **global role** (no per-course capacity column
  in v1).
- **`enrollments`** — `id`, `course_id`, `user_id`, `group`, `program`, `year`,
  timestamps; unique `(course_id, user_id)`. **All course-local roster fields live
  here** (group, program, year). The User keeps only identity (`id_code`/sid, prefix,
  first/last name).
- A **roster student is still a User** with the Student role. Add/import does
  **find-or-create by `id_code`** then enroll; an existing user is reused (Student role
  ensured) without overwriting their name; re-enrolling into the same course is
  rejected as a duplicate.
- **Email:** optional in the roster form/import; when blank, derive
  `{id_code}@kmitl.ac.th` so the account can log in.
- **Delete on a roster row = un-enroll** (remove the enrollment only); the User and
  other-course enrollments survive. Full user deletion stays in Admin User Management.
- **Edit on a roster row** changes enrollment fields (group/program/year) and the
  shared user's name/prefix; `id_code` is read-only.
- **Access:** Admin → all courses. Instructor → roster CRUD + course management for
  assigned courses. TA → **view-only** roster on assigned courses. The navbar switcher
  and APIs are scoped to entitled courses; selection persists in an `active_course`
  cookie (mirroring `active_role`), with a friendly empty state when a user has no
  courses.

## Consequences

**Positive**
- Honors the requirement's course semantics; the navbar switcher becomes real.
- One identity model — reuses `users`, validation, bcrypt, roles, and the
  client-side xlsx import/dropzone/preview patterns.
- Per-course group/program/year is expressible; the same student can differ per course.

**Negative / costs**
- A new domain (courses, course_instructors, enrollments) plus a `/courses` CRUD page
  and per-course authorization the project didn't previously need — materially larger
  than a global-list approach.
- Two paths now create users (Admin import, teacher enroll). Acceptable because both
  converge on one `users` row, but worth keeping coherent.
- `id_code` becomes a de-facto matching key for students; data without it (legacy
  staff users) is unaffected but the find-or-create logic must guard the null case.

## Alternatives considered

- **Global Student list over `users`** (no courses): cheapest, maximal reuse, but the
  course switcher stays decorative and group/program/year have nowhere course-local to
  live. Rejected — contradicts the chosen course scoping.
- **Separate roster-only `students` table** (no login): matches the mockup's
  emailless modal literally, but creates a second identity model and students couldn't
  log in to submit code. Rejected.
- **program/year on the User**: simpler joins, but the requirement records them per
  course offering; chosen to keep all roster-display fields on the enrollment.
