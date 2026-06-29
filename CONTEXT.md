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

### Nickname
An optional display name a **User** sets for themselves on `/profile`. Stored in
`users.nickname`. When set, the navbar shows nickname instead of the official `name`.
Clearing it reverts to `name`. Only the user can edit their own nickname; `name` is
managed by Admin only.

### Student
A **User** who carries the Student role. There is no separate roster-only student
record — a roster entry *is* a User. A Student logs in to submit code.

### Course
A subject offering (e.g. `01076021 · โครงสร้างข้อมูลและอัลกอริทึม`). Has a code, a
Thai name, an English name, and a **Course Language**. Owns a roster of enrolled
Students. Selectable via the navbar course switcher. Courses are managed
(created/edited) by Admin/Instructor.

### Course Language (ภาษาของรายวิชา)
The programming language a Course is taught and graded in — **Python** or **C** (ADR
0009). Chosen in the course create/edit form and stored on `courses.language`. Every
**Problem** in the course inherits it: the language is set server-side from the course
and is shown read-only in the Problem editor (not a per-problem pick). It may be
changed freely **only while the course has no Problems** (the *language lock*); once
Problems exist the course language is fixed. C is **I/O-mode only** — **Unit Test
Mode** and AI generation are Python-only.

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

### Course Duplication (ทำซ้ำไปภาคใหม่)
Copying a whole **Course** offering to another academic term — same course `code`, a new
`(year, semester)`. Triggered by Admin/Instructor from the รายวิชา list. The operation
**creates** the target offering (it must not already exist) and copies everything that
defines the course content: the **Course Language**, **Course staff** (plus the acting
user), every **Week** (`week_no` + `topic`), every **Problem** (all fields including the
**Reference Solution**), and every **Test Case**. Term-specific state is deliberately reset: **Due Date** / **Close
Date** are cleared and every Week starts as an unreleased (hidden) **Released Week**.
**Enrollments** and **Submissions** are never copied — a new term has a new roster and a
clean gradebook. The copy is atomic (all-or-nothing).

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
Has a `week_no` (integer), a `topic` (editable by Instructor), and an `is_released`
flag (see **Released Week**). Six weeks are auto-seeded with empty topics when a
Course is created; the Instructor appends or removes weeks (the last empty one) and
manages topics separately. Week is course-scoped — `weeks` table carries composite
FK `(course_code, course_year, course_semester)` + `week_no` + `topic` + `is_released`.

### Problem (โจทย์ปัญหา)
A programming challenge belonging to one **Course** and one **Week**. Carries a title,
description, input/output specification, and one or more **Test Cases**. Total points
equals the sum of all Test Case scores. Its language is inherited from the **Course
Language** (server-authoritative — set from the course on create/update, never from
the client). Problems are course-scoped and managed (created/edited/deleted) by
Instructor; TA has view-only access.

### Test Case
An input/expected-output pair belonging to an **I/O Problem**. Carries a `score` (points),
an `is_hidden` flag (hidden cases run at submit time but are never shown to Students),
and a `sort_order`. The sum of all Test Case scores is the Problem's total points.
Expected outputs are ideally generated by running the **Reference Solution** through
Piston rather than typed by hand. (**Unit Test Mode** problems do not use Test Cases —
they use a single **Unit Test Code** block instead.)

### Reference Solution (เฉลยอ้างอิง)
A solution (in the **Course Language** — Python or C) authored by the Instructor and
stored per **Problem**. Used exclusively for authoring-time test-case verification —
the Instructor clicks "รันเฉลย" to compile + run it against all **Test Case** inputs
via Piston and confirm or repair expected outputs. The reference solution is **never** exposed to Students or included in any
student-reachable API response. Request/page paths read it only through the staff-gated
reader `getReferenceSolutionForStaff` (the Problem edit page); the raw column read is
reserved for already-authorized server-side work (course duplication). The "รันเฉลย"
run-reference endpoint runs the Instructor-supplied code from the request body and does
**not** read the stored reference solution. Stored in `problems.reference_solution`
(empty string when not set).

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

### Problem Type (ประเภทโจทย์)
One of `"io"` or `"unit"`, set per **Problem** by the Instructor. Controls how the grader runs student code.
- `"io"` (default) — stdin/stdout comparison: student code reads from stdin, grader compares stdout to expected output. Scored per **Test Case**.
- `"unit"` — the Instructor writes a single **Unit Test Code** block (assert statements); the student's code is prepended and the block runs once. **All-or-nothing** scoring against the Problem's `score`.

### Unit Test Mode (โหมด Unit Test)
A **Problem** grading mode (`problem_type = 'unit'`) where the Instructor writes a single block of Python test code using `assert` statements (stored in `problems.unit_test_code`) instead of per-case stdin/stdout or args/return pairs. At grade time the student's submitted code is prepended before the block and the whole thing runs once in Piston: if every assert passes (exit 0) the student earns the full Problem `score`, otherwise `0` (all-or-nothing). On failure the student sees the stderr **traceback** (the failing assert + message) but never the full test block. Unit Test problems do **not** use the **Test Case** table. Students write their solution starting from the **Starter Code** the Instructor provides. **Python-only:** the harness runs through the Python runtime, so Unit Test Mode is unavailable in C courses (hidden in the editor and rejected by validation — ADR 0009).

### Starter Code (โค้ดตั้งต้น)
Optional template code set by the Instructor per **Problem** that pre-populates the student's code editor when they first open the problem. In unit test problems, this is typically the function signature (`def add(a, b):`). Applies to both I/O and unit test problems. A student's saved submission takes precedence over starter code when they return to a problem.

### Function Name (ชื่อฟังก์ชัน)
An **optional** field on a **Unit Test Mode** problem naming the Python function students implement. Stored in `problems.function_name`. Since the grading harness is now a free-form **Unit Test Code** block (which calls whatever it needs), the function name is no longer required — it serves only as a hint for AI generation and the **Starter Code** scaffold.

### Unit Test Code (โค้ดทดสอบ)
The single block of Python `assert` statements an Instructor writes for a **Unit Test Mode** problem (`problems.unit_test_code`). The student's submitted code is prepended before this block at grade time. Hidden from students; only its pass/fail outcome and (on failure) the stderr traceback are surfaced. AI generation and "รันเฉลย" both target this block.

### Code Policy (นโยบาย Code)
An optional set of rules on a **Problem** that restricts what code students may submit. Consists of two independent lists — **Blacklist** and **Whitelist** — checked via whole-word regex before any test runs. A violation rejects the submission immediately with a message identifying which term was flagged. Applies to both `mode:run` and `mode:submit`, and to both I/O and unit test problems.

### Blacklist (รายการห้ามใช้)
A list of terms configured per **Problem** that must **not** appear in the student's submitted code. Example use: forbidding `sorted` or `sort` to require students to implement sorting themselves. Stored in `problems.blacklist TEXT[]`. Matched with whole-word regex so `sort` does not match `quicksort` or `sort_key`.

### Whitelist (รายการต้องมี)
A list of terms configured per **Problem** that **must** appear in the student's submitted code. Example use: requiring `def` or `recursion` to enforce a particular coding pattern. Stored in `problems.whitelist TEXT[]`. Matched with whole-word regex.

### Gradebook (สมุดคะแนน — มุมมองอาจารย์/Staff)
The staff-facing matrix of **every** enrolled Student × every **Problem** in a Course,
each cell holding that student's **Effective Score**. Read by Admin/Instructor/TA. The
instructor's overview of the whole class. Distinct from **Scorebook**.

### Scorebook (สมุดคะแนนของฉัน — มุมมองนักศึกษา)
A single **Student's** own scores across all **Problems** in a Course — one row per
Problem, plus a course total and progress ring. Read-only and strictly self-scoped: a
Student sees only their own **Effective Scores**, never another student's. The
single-student counterpart to the **Gradebook**.
