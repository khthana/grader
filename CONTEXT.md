# CE-Grader — Context Glossary

The shared language of the CE-Grader domain. This is a glossary, not a spec.
Terms here have one agreed meaning; use them consistently in code and conversation.

## Terms

### User
A person with an account in the system. Stored in the `users` table, may log in
(email/password or Google). Carries one or more **Roles**.

### Role
One of **Admin / Instructor / TA / Student**, many-to-many with User. Admin is a
superset. Drives sidebar, landing route, and permissions. (The requirement docs say
"Teacher" — in this project that maps to **Instructor** (and **TA**); there is no
distinct Teacher role.)

### Student
A **User** who carries the Student role. There is no separate roster-only student
record — a roster entry *is* a User. A Student logs in to submit code.

### Course
A subject offering (e.g. `01076021 · โครงสร้างข้อมูลและอัลกอริทึม`). Has a code, a
Thai name, an English name. Owns a roster of enrolled Students. Selectable via the
navbar course switcher. Courses are managed (created/edited) by Admin/Instructor.

### Enrollment
The link between a **Student** and a **Course** — i.e. membership in a course's
roster. Carries all course-local attributes: **Group**, **Program**, and **Year**.
Adding a student to a course's รายชื่อนักศึกษา creates an Enrollment (finding-or-
creating the User first). A User's identity (sid/`id_code`, prefix, first/last name)
stays on the User; everything shown in the roster *besides* the name lives here.

### Course staff (ผู้สอน / ผู้ช่วยสอน)
The Users assigned to manage a Course — stored in `course_instructors`. Whether an
assigned staff member acts as an **Instructor** (full roster CRUD + course
management) or a **TA** (read-only roster) is read from their global **Role**; there
is no per-course capacity column (v1). Being assigned is what grants entitlement to a
Course (drives the switcher and every roster/course route). Admin is entitled to all
Courses without assignment.

### Roster (รายชื่อนักศึกษา)
The set of Students enrolled in a given Course — i.e. that Course's Enrollments. The
`/students` page shows the roster of the currently-selected Course.

### Group (กลุ่มเรียน)
A section within a Course (e.g. กลุ่ม 1 / กลุ่ม 2). An attribute of an **Enrollment**,
not of the Student — the same Student could be in different groups in different courses.

### Program (หลักสูตร)
A student's degree program (e.g. วิศวกรรมคอมพิวเตอร์), as recorded for a course. An
attribute of the **Enrollment** — captured per course rather than globally on the User.

### Year (ปีการศึกษา)
The student's admission/cohort year in the Buddhist calendar (e.g. 2565), as recorded
for a course. An attribute of the **Enrollment**.

### Week (สัปดาห์)
A numbered weekly unit within a **Course** (e.g. Week 1 · "พื้นฐาน Python และ I/O").
Has a `week_no` (integer) and a `topic` (editable by Instructor). Six weeks are
auto-seeded with empty topics when a Course is created; the Instructor appends or
removes weeks (the last empty one) and manages topics separately. Week is
course-scoped — `weeks` table carries `(course_id, week_no, topic)`.

### Problem (โจทย์ปัญหา)
A programming challenge belonging to one **Course** and one **Week**. Carries a title,
description, input/output specification, and one or more **Test Cases**. Total points
equals the sum of all Test Case scores. Problems are course-scoped and managed
(created/edited/deleted) by Instructor; TA has view-only access.

### Test Case
An input/expected-output pair belonging to a **Problem**. Carries a `score` (points),
an `is_hidden` flag (hidden cases run at submit time but are never shown to Students),
and a `sort_order`. The sum of all Test Case scores is the Problem's total points.

### Submission (การส่งงาน)
A Student's attempt at a **Problem**. Records the code, `submitted_at`, `points_earned`
(from Piston auto-grading), `points_max` (total at submission time), `is_late`, and
`results` (per-test-case outcome as JSONB). An Instructor may override the auto-grade
via `manual_score`; effective score = `COALESCE(manual_score, points_earned)`.
Unreviewed submissions count toward the "รอตรวจ" badge on the problem list.

### Due Date (กำหนดส่ง)
The soft deadline on a **Problem** (`due_at TIMESTAMPTZ NULLABLE`). Submissions after
this timestamp are accepted but flagged as **Late**. If `due_at` is NULL the problem
has no soft deadline.

### Close Date (วันปิดรับ)
The hard cutoff on a **Problem** (`close_at TIMESTAMPTZ NULLABLE`). Submissions after
this timestamp are rejected by `/api/grade` with 403. If `close_at` is NULL submissions
are accepted indefinitely (subject to the Due Date late flag only).

### Late Submission
A **Submission** made after the **Due Date** but before the **Close Date**. Stored as
`is_late = true`. Instructors can filter the student list by late submissions.

### Effective Score
The score that counts for a **Submission**: `COALESCE(manual_score, points_earned)` —
the Instructor's `manual_score` override when present, otherwise the Piston auto-grade.
The single number shown wherever a student's score appears (Gradebook, Scorebook,
Assignments). A submission that has been auto-graded but not yet reviewed still has an
effective score (its auto-grade).

### Released Week (สัปดาห์ที่ปล่อยแล้ว)
A **Week** whose `is_released` flag is `true`. Only Released Weeks are visible to Students — they appear in the WeekBar on Assignments, Scorebook, and Problems pages, and their Problems are accessible via direct URL. Unreleased (hidden) Weeks are visible only to Admin, Instructor, and TA, who see a lock icon on the week card and can toggle the release state. New Weeks default to unreleased. Toggling is manual (no scheduled release in v1).

### Gradebook (สมุดคะแนน — มุมมองอาจารย์/Staff)
The staff-facing matrix of **every** enrolled Student × every **Problem** in a Course,
each cell holding that student's **Effective Score**. Read by Admin/Instructor/TA. The
instructor's overview of the whole class. Distinct from **Scorebook**.

### Scorebook (สมุดคะแนนของฉัน — มุมมองนักศึกษา)
A single **Student's** own scores across all **Problems** in a Course — one row per
Problem, plus a course total and progress ring. Read-only and strictly self-scoped: a
Student sees only their own **Effective Scores**, never another student's. The
single-student counterpart to the **Gradebook**.
