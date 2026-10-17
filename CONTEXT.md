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

### Syllabus (ประมวลรายวิชา)
The published description of one **Course** offering — what the course is about, what a
Student will be able to do by the end, the week-by-week plan, how the grade is made
up, and what to learn from (**Learning Resources**). Each offering has its own Syllabus (a new term may change it); **Course Duplication**
carries it to the new term as the starting point. Its general information shows the
Course's own code and names (not a second copy) plus the **Credits**. Its instructors are
the **Course staff**, as they stand — ผู้สอน (Instructor, or an Admin on the staff) and
ผู้ช่วยสอน (TA), by official name and email; never a separately typed list.
_Avoid_: course outline (that is one part of a Syllabus), มคอ.3

### Course Description (คำอธิบายรายวิชา) · Learning Objectives (วัตถุประสงค์การเรียนรู้)
Two formatted-text parts of a **Syllabus**: what the course covers, and what a Student
will know or be able to do on finishing it. Learning Objectives are written as one
formatted block (numbered, possibly grouped or nested), not as separately managed items.

### Credits (หน่วยกิต)
The credit statement of a Course as written in its **Syllabus**, in the university's
notation — e.g. `3(2-2-5)` (total, lecture-practice-self-study hours). Free text, shown
as written; nothing computes from it.

### Teaching Plan (แผนการสอนรายสัปดาห์)
The week-by-week part of a **Syllabus**: each entry has a week number, a topic and
optional detail, and may cover weeks with no Problems (e.g. midterm / final exam weeks).
A week may have several entries; a topic spanning two weeks is one entry per week.
Entries read in week order.
It is **not** the **Week** — a Week is a unit of Problems that is released to Students;
the Teaching Plan is shown in full from the start, whatever has been released, and the
two may differ in count and topics.
_Avoid_: Week topic (that belongs to a Week), course schedule

### Assessment Component (เกณฑ์การวัดผล)
One part of how a Course is graded, as stated in its **Syllabus** — a name (e.g.
งาน/แบบฝึกหัด, สอบกลางภาค, สอบปลายภาค, การเข้าเรียน), a weight in percent, and an
optional note. It is a **statement**, not a calculation: the **Gradebook** and
**Scorebook** do not weight or combine scores by it.
_Avoid_: grading criteria, score weight (as if it were computed)

### Learning Resources (แหล่งเรียนรู้)
The last part of a **Syllabus**: the textbooks, readings, websites and other material a
Student can learn from. Written as one formatted block (it may be grouped — e.g. main
textbook / further reading / websites — and its links open outside CE-Grader), not as
separately managed items; nothing counts or sorts them.
_Avoid_: references (only one kind of resource), course materials (suggests files hosted here)

### Course Duplication (ทำซ้ำไปภาคใหม่)
Copying a whole **Course** offering to another academic term — same course `code`, a new
`(year, semester)`. Triggered by Admin/Instructor from the รายวิชา list. The operation
**creates** the target offering (it must not already exist) and copies everything that
defines the course content: the **Course Language**, **Course staff** (plus the acting
user), every **Week** (`week_no` + `topic`), every **Problem** (all fields including the
**Reference Solution**), every **Test Case**, and every **Quiz** (questions, answer key,
Don't Know setting, Week by `week_no`), and the **Syllabus** (general information,
Teaching Plan and Assessment Components — the new term's starting point; a course
without one gets none). Term-specific state is deliberately reset: **Due Date** / **Close
Date** are cleared, every Week starts as an unreleased (hidden) **Released Week**, and no
**Round Window** is copied (a copied Quiz is unlocked).
**Enrollments**, **Submissions** and **Quiz Attempts** are never copied — a new term has a new roster and a
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

### Reference Verification (รันเฉลย)
Running a draft **Reference Solution** against the Problem's Test Case inputs (or its
**Unit Test Code**) at authoring time. It goes through the same code runner and pass
rule as grading (#85): a case is 🔴 only when the program didn't run cleanly (compile
failure, non-zero exit, signal). A stderr warning alone is fine, as in grading. ✅/⚠️
then compare stdout with the expected output.

### Problem Draft
The Problem an Instructor's create/edit request would produce: the request body merged
over defaults (create) or over the stored **Problem** (edit), then validated as a
whole (#83). An omitted field keeps its stored value. The draft is exactly what gets
written. `buildProblemDraft` is the one place this happens.

### Student View (มุมมองนักศึกษา)
What a viewer may see of a **Problem** or a grading result (#84). Course staff see
everything. A Student never sees a hidden **Test Case**, the **Unit Test Code**, or
anything of a unit run beyond pass/fail. Of an io result, they see output only for a
visible case. `problemFor` / `gradeResultFor` in `student-view.ts` are the one
definition; the stored **Submission** keeps full results for staff.

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

### Submission Window
The state of a **Problem** at a given instant, from its **Due Date** and **Close Date**
(ADR 0002): **open** → **late** (past the Due Date) → **closed** (past the Close Date,
checked first). A deadline is past only strictly after its instant; a NULL one never
passes. `submissionWindow(problem, now)` is the one definition — the grade route, the
problem page and the student's assignment badges all ask it.

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
A **Week** whose `is_released` flag is `true`. Only Released Weeks are visible to Students — they appear in the WeekBar on Assignments, Scorebook, and Problems pages, and their Problems are accessible via direct URL. The gate is enforced server-side too: the problems/assignments/weeks APIs filter hidden Weeks, the problem API 404s, and grading refuses them (#74). Unreleased (hidden) Weeks are visible only to Admin and the **course's own staff** (Instructor/TA assigned to *that* course — a TA enrolled as a student elsewhere sees only released weeks there), who see a lock icon on the week card and can toggle the release state. New Weeks default to unreleased. Toggling is manual (no scheduled release in v1).

### Problem Type (ประเภทโจทย์)
One of `"io"` or `"unit"`, set per **Problem** by the Instructor. Controls how the grader runs student code.
- `"io"` (default) — stdin/stdout comparison: student code reads from stdin, grader compares stdout to expected output. Scored per **Test Case**.
- `"unit"` — the Instructor writes a single **Unit Test Code** block (assert statements); the student's code is prepended and the block runs once. **All-or-nothing** scoring against the Problem's `score`.

### Unit Test Mode (โหมด Unit Test)
A **Problem** grading mode (`problem_type = 'unit'`) where the Instructor writes a single block of Python test code using `assert` statements (stored in `problems.unit_test_code`) instead of per-case stdin/stdout or args/return pairs. At grade time the student's submitted code is prepended before the block and the whole thing runs once in Piston: if every assert passes (exit 0) the student earns the full Problem `score`, otherwise `0` (all-or-nothing). The student sees **pass/fail only** — never the stderr traceback or stdout, because their code runs in the same file as the tests and could print or raise the block itself (#79); course staff and the stored **Submission** keep the traceback. Unit Test problems do **not** use the **Test Case** table. Students write their solution starting from the **Starter Code** the Instructor provides. **Python-only:** the harness runs through the Python runtime, so Unit Test Mode is unavailable in C courses (hidden in the editor and rejected by validation — ADR 0009).

### Starter Code (โค้ดตั้งต้น)
Optional template code set by the Instructor per **Problem** that pre-populates the student's code editor when they first open the problem. In unit test problems, this is typically the function signature (`def add(a, b):`). Applies to both I/O and unit test problems. A student's saved submission takes precedence over starter code when they return to a problem.

### Function Name (ชื่อฟังก์ชัน)
An **optional** field on a **Unit Test Mode** problem naming the Python function students implement. Stored in `problems.function_name`. Since the grading harness is now a free-form **Unit Test Code** block (which calls whatever it needs), the function name is no longer required — it serves only as a hint for AI generation and the **Starter Code** scaffold.

### Unit Test Code (โค้ดทดสอบ)
The single block of Python `assert` statements an Instructor writes for a **Unit Test Mode** problem (`problems.unit_test_code`). The student's submitted code is prepended before this block at grade time. Hidden from students; only its pass/fail outcome is surfaced (the traceback goes to staff only — #79). AI generation and "รันเฉลย" both target this block.

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

### Quiz (แบบทดสอบ)
A set of multiple-choice **Quiz Questions** in a Course, optionally tied to one **Week**,
used to measure learning — not a **Problem** (no code is run). One Quiz is taken in two
**Quiz Rounds**, **Pre** and **Post**, over the **same** questions, so results compare
question-by-question. Editing the Quiz changes what both rounds ask. Questions arrive by JSON import, and a Quiz
is **locked** once any Student has started an attempt at either round (opening an open
round starts one) — its questions can no longer be
changed, so Pre and Post stay comparable.
Its **Week** is only a label for grouping — a Quiz ignores **Released Week**: a Student sees
it once one of its rounds has opened for their Group (a Pre-test runs before its Week is
released). Quiz scores never enter the **Gradebook** or **Scorebook**.
_Avoid_: "Pre-test" / "Post-test" as separate things — they are rounds of one Quiz.

### Quiz Round (รอบ Pre-test / Post-test)
One of the two sittings of a **Quiz**: **Pre** (before teaching) or **Post** (after).
Each round opens and closes independently, and a Student answers each round separately.

### Round Window (ช่วงเปิดสอบ)
When a **Quiz Round** accepts answers, set **per Group**: an optional open instant and an
optional close instant, from which the state follows — **not yet open** → **open** →
**closed**. Opening or closing "manually" just sets that instant to now; there is no
separate open flag. Students with no Group share one "ไม่ระบุกลุ่ม" window. Within one
Group, the Pre and Post windows of a Quiz must not overlap — the close instant is the
first moment it is closed, so a Post may open exactly when its Pre closes. A Student is governed by the
window of their current Group; there are no per-student overrides.

### Quiz Question (ข้อสอบ)
One single-answer multiple-choice item in a **Quiz**: a prompt, an optional code snippet,
lettered choices of which exactly one is correct, and an explanation (feedback). Worth one
point. Ungraded survey items (checkbox / scale "background" questions) are not Quiz
Questions and are out of scope.

### Don't Know answer (ไม่ทราบ)
A built-in extra answer the system appends to every **Quiz Question** when the Quiz enables
it (on by default). Scores zero like a wrong answer, but is reported separately: each
question's outcome is **correct / wrong / don't know**, so "never learned it" is told apart
from "misunderstood it".

### Quiz Attempt (การทำแบบทดสอบ)
One Student's answers to one **Quiz Round** — at most one per Student per round. Answers
are saved as the Student goes; the attempt is **submitted** either by the Student (only
once every question is answered, "ไม่ทราบ" counting as an answer) or automatically when the
**Round Window** closes, in which case unanswered questions score zero. A submitted attempt
cannot be changed — even if staff later reopen or clear that window. There is no per-attempt timer — the Round Window is the only limit.
Only Students enrolled in the Course make attempts; staff can preview a Quiz without one.
Questions and choices appear in their authored order (no shuffling), Don't Know last.

### Answer Key Release (การเปิดเฉลย)
What a Student sees of their own **Quiz Attempts**. Right after submitting either round:
their score and each question's outcome (correct / wrong / don't know) with its topic —
**never** the correct choice or the explanation. The correct choices, explanations and the
Pre-vs-Post comparison are released only once the **Post** **Round Window** of the
Student's Group has closed (whether or not they took it), because both rounds ask the same
questions and an early key would leak into a still-open Post — and never while that Group's
Pre is open (e.g. reopened for a make-up sitting).
