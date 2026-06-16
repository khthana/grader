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
