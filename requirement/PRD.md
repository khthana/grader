# PRD — CE-Grader (ทุก Feature รวมในไฟล์เดียว)

> CE-Grader — ระบบตรวจและให้คะแนน Python code ของนักศึกษาอัตโนมัติ
> Faculty of Engineering, KMITL
> Domain glossary: `CONTEXT.md` · Architecture decisions: `docs/adr/`

---

## Section 00 · Login Page Spec

### Overview

The Login page is the entry point of the **Python Programming Automated Grader** system. It supports two authentication methods: Google OAuth and username/password. Upon successful authentication, the user is redirected to the main dashboard.

### User Flow

#### Path A — Google Authentication

1. User navigates to the login page.
2. User clicks **"Sign in with Google"**.
3. System redirects the user to Google OAuth consent screen.
4. Upon successful Google authentication, Google redirects back to the app with an auth code.
5. System validates the token and creates/resumes the session.
6. User is redirected to the main dashboard.

#### Path B — Username & Password

1. User navigates to the login page.
2. User enters email and password, then clicks **"Login"**.
3. System validates inputs client-side (see Input Validation).
4. System sends credentials to the backend.
5. On success, session is established and user is redirected to the main dashboard.
6. On failure, an appropriate error message is displayed inline.

### Input Validation

| Field | Rule | Error Message |
|---|---|---|
| Email | Required. Must be a valid email format (e.g. `user@kmitl.ac.th`) | "Please enter a valid email address." |
| Password | Required. Minimum 8 characters. Must contain at least one uppercase letter, one lowercase letter, one number, and one special character (e.g. `!@#$%`) | "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character." |

> Validation fires on **submit**, not on every keystroke.

### UI Requirements

- Follow the layout and visual style defined in `design.md` (colors, typography, spacing, components).
- The login form must be centered and responsive across screen sizes (mobile, tablet, desktop).
- Two clearly separated login options: Google button (primary) and email/password form (secondary, separated by a divider).
- Show a loading indicator while authentication is in progress (disable the login button to prevent double-submit).

### Error Handling

| Scenario | Message |
|---|---|
| Invalid email format | "Please enter a valid email address." |
| Password too weak | "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character." |
| Wrong email or password | "Invalid email or password. Please try again." |
| Google auth cancelled or failed | "Google sign-in was cancelled or failed. Please try again." |
| Server / network error | "Something went wrong. Please try again later." |
| Account not found / unauthorized | "Your account is not registered in this system. Please contact your administrator." |

### Security Considerations

- Rate-limit login attempts (e.g. lock for 5 minutes after 5 consecutive failures).
- Do not indicate whether the email exists — always return a generic "Invalid email or password" message.
- Transmit credentials over HTTPS only.
- Session token must be stored in an HttpOnly cookie (not localStorage).

### Out of Scope

- User registration / sign-up
- Forgot password flow *(link may be displayed but implementation is a separate requirement)*
- Main dashboard page *(separate requirement)*

### Test Cases

| # | Scenario | Input | Expected Result |
|---|---|---|---|
| TC-01 | Valid login | Email: `user@kmitl.ac.th`, Password: `Secure@123` | Redirect to main dashboard |
| TC-02 | Empty email | Email: *(blank)*, Password: `Secure@123` | Show: "Please enter a valid email address." |
| TC-03 | Invalid email format | Email: `notanemail`, Password: `Secure@123` | Show: "Please enter a valid email address." |
| TC-04 | Empty password | Email: `user@kmitl.ac.th`, Password: *(blank)* | Show password required error |
| TC-05 | Weak password | Email: `user@kmitl.ac.th`, Password: `password123` | Show: "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character." |
| TC-06 | Wrong password | Email: `user@kmitl.ac.th`, Password: `WrongPass!1` | Show: "Invalid email or password. Please try again." |
| TC-07 | Unregistered email | Email: `ghost@kmitl.ac.th`, Password: `Secure@123` | Show: "Invalid email or password. Please try again." *(same message — do not reveal if email exists)* |
| TC-08 | Server error | *(simulate 500 from backend)* | Show: "Something went wrong. Please try again later." |
| TC-09 | Google auth — success | Click "Sign in with Google" → complete Google flow | Redirect to main dashboard |
| TC-10 | Google auth — cancelled | Click "Sign in with Google" → cancel on Google screen | Show: "Google sign-in was cancelled or failed. Please try again." |
| TC-11 | Double submit | Click login twice rapidly | Button disabled after first click; only one request sent |

---

## PRD 01 · Auth, Shell & User Management

> Status: Delivered
> Scope owner: CE-Grader (Computer Engineering Python Grader), Faculty of Engineering, KMITL
> References (read-only inspiration, NOT build targets): `DEEP-QA-FRONTEND/`, `DEEP-QA-BACKEND/`

### Problem Statement

CE-Grader's login page looks finished but isn't actually usable: it redirects to a route (`/`) that doesn't exist, there is no route protection, no application shell (navbar/sidebar/breadcrumb), no way to manage who can log in, and its authentication is backed by two hard-coded in-memory users. As a CE staff member I can't onboard real instructors, TAs, or students, and as any user I have nowhere to land after signing in.

A separate, polished product — DEEP-QA — already solves the "sign in, see a role-based shell, manage users" problem with a working login, a navbar/sidebar/breadcrumb shell, and a User Management screen. CE-Grader should adopt that *look and feel and proven UX*, but as its own product with its own simpler domain.

### Solution

Make CE-Grader's login genuinely work, then build the authenticated experience around it — entirely inside the existing `grader/` Next.js app, reusing DEEP-QA only as a visual/UX reference.

From the user's perspective:

- I sign in with email/password (or Google) and land on a page appropriate to my role.
- I see a consistent shell on every page: a top navbar with the CE-Grader logo, a role switcher, and my profile menu; a collapsible sidebar whose menu reflects my role; and a breadcrumb trail.
- If I'm an Admin, I land on **User Management**, where I can list/search users, add them, edit their details, delete them, assign and revoke roles, bulk-import users from Excel, and review a user activity log.
- If I'm an Instructor or TA, I land on a teaching area with a sidebar for รายชื่อนักศึกษา · โจทย์ปัญหา · ตรวจงาน · สมุดคะแนน.
- If I'm a Student, I land on a student area with งานที่ได้รับมอบหมาย · สมุดคะแนนของฉัน.

### User Stories

#### Authentication & session
1. As an unauthenticated visitor, I want to be redirected to the login page when I open any protected route, so that I can't see app content without signing in.
2. As a user, I want to sign in with my email and password, so that I can access the system without a Google account.
3. As a user, I want client-side validation of my email and password before submission, so that I get immediate feedback on obvious mistakes.
4. As a user, I want clear, distinct error messages for "wrong credentials," "account not registered," and "server error," so that I know how to proceed.
5. As a user, I want to sign in with Google, so that I can use my institutional account.
6. As a user whose Google account isn't registered in CE-Grader, I want to be told my account isn't registered, so that I know to contact an administrator.
7. As a signed-in user, I want my session to persist (8 hours) via a secure HttpOnly cookie, so that I stay logged in across page loads.
8. As a signed-in user, I want to log out, so that I can end my session on a shared machine.
9. As a signed-in user, I want my session validated on every protected request, so that an expired or tampered session sends me back to login.
10. As a user with a password, I want my password stored hashed (bcrypt), so that my credentials are protected if the database leaks.
11. As a signed-in user, I want to be redirected away from the login page if I'm already authenticated, so that I'm not asked to log in twice.

#### Shell — navbar, sidebar, breadcrumb
12. As a signed-in user, I want a top navbar with the CE-Grader logo, so that I always know which product I'm in.
13. As a signed-in user, I want my name and avatar in the navbar, so that I can confirm who I'm signed in as.
14. As a signed-in user, I want a profile dropdown with a logout action, so that I can manage my session.
15. As a user with multiple roles, I want a role switcher in the navbar, so that I can change which role's view I'm using.
16. As a user, I want switching roles to update both the sidebar menu and my landing context, so that the UI reflects my active role.
17. As a signed-in user, I want a sidebar whose menu items match my role, so that I only see features relevant to me.
18. As a user on a small screen, I want to collapse/expand the sidebar (320px ↔ 80px), so that I can reclaim screen space.
19. As a signed-in user, I want a breadcrumb trail derived from the current path with Thai labels, so that I can orient myself and navigate back up.
20. As a signed-in user, I want consistent toast/snackbar notifications for actions (success/error), so that I get feedback without disruptive dialogs.
21. As a signed-in user, I want the navbar and sidebar to follow the CE-Grader/DEEP-QA design system (primary `#0F2A60`, secondary `#003296`, `font-thai`), so that the experience feels cohesive with the login page.

#### Role-based landing & navigation
22. As an Admin, I want to land on User Management after login, so that I can get straight to administering accounts.
23. As an Admin, I want a sidebar that is a superset of all areas, so that I can access everything.
24. As an Instructor, I want to land on the teaching area with a sidebar of รายชื่อนักศึกษา · โจทย์ปัญหา · ตรวจงาน · สมุดคะแนน, so that I can run my course.
25. As a TA, I want the same teaching sidebar as an Instructor, so that I can assist with the course.
26. As a Student, I want to land on the student area with งานที่ได้รับมอบหมาย · สมุดคะแนนของฉัน, so that I can see my work and grades.

#### User Management (Admin)
27. As an Admin, I want a paginated, searchable table of all users, so that I can find any account.
28. As an Admin, I want to see each user's name, email, ID code, roles, and status in the table, so that I can assess accounts at a glance.
29. As an Admin, I want to add a new user with their Thai and English title/first/last name, email, phone, ID code, password, and role(s), so that I can onboard people.
30. As an Admin, I want validation when adding a user (required fields, valid email, password policy), so that I don't create broken accounts.
31. As an Admin, I want to edit a user's personal data, so that I can correct or update their details.
32. As an Admin, I want to assign and revoke roles for a user (Admin/Instructor/TA/Student), so that I can control their access.
33. As an Admin, I want to delete a user, with a confirmation step, so that I can remove accounts safely.
34. As an Admin, I want to activate/deactivate a user, so that I can disable access without deleting the record.
35. As an Admin, I want to bulk-import users from an Excel file using a template, so that I can onboard a class at once.
36. As an Admin, I want per-row error reporting on import (which row failed and why), so that I can fix and re-import only the bad rows.
37. As an Admin, I want to view a user activity log, so that I can audit what happened in the system.
38. As an Admin, I want user actions (create/update/delete/role change/login) recorded to the activity log, so that the audit trail is meaningful.

### Implementation Decisions

- CE-Grader is a **standalone product**. `DEEP-QA-FRONTEND` and `DEEP-QA-BACKEND` are **read-only references** for look/feel and UX patterns only.
- All work happens inside the existing `grader/` app: **Next.js 16 (App Router) · TypeScript · Tailwind v4**. Shell and User Management use plain Tailwind v4 + `react-icons`. No MUI, no framer-motion.
- **HMAC-signed session token** in an HttpOnly cookie (8h). Passwords are **bcrypt-hashed**. Google activates once `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are provided.
- Four roles: **Admin / Instructor / TA / Student**, many-to-many (`user_roles`). Admin is a superset.
- Authenticated pages live under a **route group** with the shell as layout. Route protection via `src/proxy.ts` (Next 16, Node runtime).
- **Breadcrumb** derived from pathname via Thai label map (pure function, unit-tested).
- **DB (Postgres, raw `pg`):** `users`, `roles`, `user_roles`, `user_logs`. Single `users` table; a student is a user with the Student role.

### Testing Decisions

Pure modules (session, password, roles, breadcrumb, xlsx import validation) are unit-tested. User repository is integration-tested against pg-mem. Route handlers invoked with `NextRequest` + real `createSessionToken` cookie.

### Out of Scope

- Forgot-password / password-reset email flows.
- Full DEEP-QA role model (FACULTY_ADMIN, DEPT_ADMIN, etc.).
- Production database provisioning.
- Any code changes in `DEEP-QA-FRONTEND/` or `DEEP-QA-BACKEND/`.

---

## PRD 02 · Course Management & รายชื่อนักศึกษา (Roster)

> Status: Delivered
> Domain glossary: `CONTEXT.md`. Decision record: `docs/adr/0001-course-scoped-roster.md`.

### Problem Statement

An Instructor has no way to manage who is in their course. The `/students` page was a "coming soon" stub and the navbar course switcher was decorative. A teacher needs to open *their* course and see, search, add, edit, remove, import, and export the students enrolled in it — without touching anyone else's course or the global user directory.

### Solution

Introduce a real **Course** domain and make `/students` show the **Roster** (รายชื่อนักศึกษา) of the currently-selected Course.

- A **Roster** entry is an **Enrollment** linking a **Student** (User with the Student role) to a **Course**. Course-local fields — **Group**, **Program**, **Year** — live on the Enrollment.
- Teachers select their course from the navbar switcher (persisted in an `active_course` cookie).
- A new **`/courses`** page lets Admin/Instructor create, edit, and delete courses and assign instructors/TAs.
- Adding/importing a student **finds-or-creates** the User by `id_code`.

### User Stories

#### Course selection & access
1. As an Instructor, I want to pick my course from the navbar switcher, so that the page shows that course's roster.
2. As an Instructor, I want my selected course remembered across navigation and reloads.
3. As an Instructor, I want to see only the courses I'm assigned to.
4. As an Admin, I want to see and open every course.
5. As a TA, I want to open the rosters of courses I'm assigned to.
6. As an Instructor with no assigned courses, I want a clear empty state.
7. As a Student, I want no access to the roster page.

#### Viewing the roster
8. As an Instructor, I want a table of students (running number, รหัสนักศึกษา, คำนำหน้า, ชื่อ-นามสกุล, หลักสูตร, กลุ่ม, ปีการศึกษา).
9. As an Instructor, I want to search by รหัส / ชื่อ / นามสกุล.
10. As an Instructor, I want to filter by group.
11. As an Instructor, I want 10 rows per page with prev/next paging.
12. As an Instructor, I want search/filter changes to reset me to page 1.
13. As an Instructor, I want a friendly "ไม่พบนักศึกษาที่ค้นหา" empty row.
14. As an Instructor, I want a "ทั้งหมด N คน" count.

#### Adding / editing / removing a student
15. As an Instructor, I want an "เพิ่มนักศึกษา" button opening a form (รหัส*, คำนำหน้า, ชื่อ*, นามสกุล*, กลุ่ม, ปีการศึกษา, หลักสูตร, email).
16. As an Instructor, I want a blank email to auto-derive `{sid}@kmitl.ac.th`.
17. As an Instructor, I want a blank หลักสูตร to inherit the course's default program.
18. As an Instructor, when the รหัส belongs to an existing user, I want them reused (not duplicated) and just enrolled.
19. As an Instructor, when the existing user already has a name, I want it kept (not overwritten by my entry).
20. As an Instructor, when I try to add a รหัส already in this course, I want a clear "รหัสนี้อยู่ในรายวิชาแล้ว" rejection.
21. As an Instructor, I want the new student to automatically gain the Student role.
22. As an Instructor, I want an edit (pen) action per row opening a prefilled form.
23. As an Instructor, I want รหัสนักศึกษา shown read-only on edit.
24. As an Instructor, I want a delete (trash) action with a confirm dialog; delete = un-enroll only (keeps user account).

#### Excel import / export
25. As an Instructor, I want a "นำเข้า Excel" button opening an import dialog.
26. As an Instructor, I want a downloadable template.
27. As an Instructor, I want a preview table of parsed rows with "พบ N รายชื่อ".
28. As an Instructor, I want invalid rows flagged per-row without blocking the valid ones.
29. As an Instructor, I want within-sheet duplicate รหัส flagged.
30. As an Instructor, I want a "ส่งออก" button downloading the full filtered roster.

#### Course management (/courses)
31. As an Instructor, I want a /courses page listing my courses.
32. As an Instructor, I want to create / edit / delete a course.
33. As an Admin, I want to assign instructors/TAs to a course.
34. As a TA, I want NOT to be able to create/delete courses or assign instructors.
35. As a TA, I want the roster shown read-only.
36. As an Admin, I want course create/edit/delete and enroll/un-enroll/import actions logged.

### Implementation Decisions

- **Schema:** `courses` PK `(code, year, semester)` (natural key, no surrogate id). `course_instructors` PK `(course_code, course_year, course_semester, user_id)`. `enrollments` PK `(course_code, course_year, course_semester, user_id)` — no surrogate id.
- **Identity:** find-or-create by `id_code`; email derived as `{id_code}@kmitl.ac.th` when blank; program inherits course default.
- **Access:** Admin → all courses; Instructor → assigned only; TA → read-only roster; Student → no access.
- **Route wrapper:** `courseRoute` + `authorizeCourse` gate on every `/api/courses*` route.
- **Client components** receive `courseSlug: string` (`"code/year/semester"`) and `coursePath: string` (`"/courses/code/year/semester"`). **Never pass `courseId: number`**.

### Out of Scope

- Per-course Instructor-vs-TA capacity column.
- Bulk course operations, archiving, or copying a roster.
- Student-facing self-enrollment.
- Numbered full pager (first/…/last).

---

## PRD 03 · Problem Management & Submission Tracking

> Status: Delivered
> Architecture decisions: `docs/adr/0002-two-tier-deadline.md`.

### Problem Statement

An Instructor has no way to create or manage programming problems. The `/problems` page was a hardcoded stub. The `/api/grade` endpoint ran hardcoded test cases. There was no problem database, no due dates, and no visibility into submissions.

### Solution

Introduce a real **Problem** domain: course-scoped Problems organised by **Week**, each with one or more **Test Cases**. Instructors create, edit, and delete Problems through a full-page Problem Editor. Problems carry a two-tier deadline (**Due Date** soft / **Close Date** hard). Student code submissions are stored as **Submissions**.

### User Stories

#### Week management
1. As an Instructor, I want weeks automatically created when I create a course.
2. As an Instructor, I want to edit the topic of each week.
3. As an Instructor, I want a horizontal scrollable WeekBar showing all weeks.
4. As an Instructor, I want the currently selected week highlighted.

#### Viewing the problem list
5. As an Instructor, I want a table of problems for the selected week (ลำดับ, ชื่อโจทย์, คะแนน, กำหนดส่ง, ส่งแล้ว X/Y, รอตรวจ N, actions).
6. As an Instructor, I want an empty-state row when a week has no problems.
7. As a TA, I want to view the problem list and editor in read-only mode.
8. As an Admin, I want to view and manage problems in any course.

#### Creating and editing problems
9. As an Instructor, I want an "+ เพิ่มโจทย์" button that opens a full-page Problem Editor.
10. As an Instructor, I want to fill in: ชื่อโจทย์, รายละเอียดโจทย์, รูปแบบ Input, รูปแบบ Output, กำหนดส่ง, วันปิดรับ, and ภาษาที่อนุญาต.
11. As an Instructor, I want "บันทึกโจทย์" to save the problem and return to the list.
12. As an Instructor, I want an edit (pen) action per row that opens the Problem Editor prefilled.
13. As an Instructor, I want a delete action with a confirmation modal.

#### Test Cases
14. As an Instructor, I want to add multiple test cases with Input, Expected Output, score, and `ซ่อนจากนักศึกษา` checkbox.
15. As an Instructor, I want a summary "N ชุด · รวม M คะแนน" updating live.
16. As an Instructor, I want to delete a test case (visible only when more than one exists).

#### Deadlines (ADR 0002)
17. As an Instructor, I want an optional กำหนดส่ง (`due_at`) per problem.
18. As an Instructor, I want an optional วันปิดรับ (`close_at`) per problem.
19. As a Student, I want my submission accepted after กำหนดส่ง but before วันปิดรับ (late flag set).
20. As a Student, I want a clear error message when I try to submit after วันปิดรับ.

#### Submission & auto-grading
21. As a Student, I want to submit Python code and receive a per-test-case pass/fail result with points earned.
22. As a Student, I want hidden test cases to run at submit time but not be shown to me.
23. As a Student, I want the "รันทดสอบ" action to run only visible test cases.
24. As a Student, I want my score expressed as "ได้ X/Y คะแนน".

#### Instructor review & score override
25. As an Instructor, I want to see a list of submissions per problem.
26. As an Instructor, I want to open a submission and see the student's code alongside the auto-graded result.
27. As an Instructor, I want to override the auto-graded score with a manual score.
28. As an Instructor, I want the effective score to be `manual_score` when set, otherwise `points_earned`.

### Implementation Decisions

- **Schema additions:** `weeks`, `problems`, `test_cases`, `submissions` tables. Effective score = `COALESCE(manual_score, points_earned)`.
- **Two-tier deadline:** `close_at` checked first → 403 if past; `due_at` → sets `is_late = true`. Both nullable.
- **Problem URLs** use `weekNo`/`problemNo` (not surrogate id): `/courses/.../problems/[weekNo]/[problemNo]`.
- **API:** `GET/POST /api/courses/.../problems`, `GET/PUT/DELETE .../problems/[pid]`, `GET/PUT .../problems/[pid]/submissions/[sid]`, `POST /api/grade`.
- **Code editor:** `@uiw/react-codemirror` + `@codemirror/lang-python`, dynamically imported `ssr: false`, dark theme.

### Out of Scope

- Per-student deadline extensions.
- Bulk problem import/export.
- Languages other than Python.
- Full numbered pager on problem list.

---

## PRD 06 · Grading Workbench (ตรวจงาน)

> Status: Delivered
> UI reference: `requirement/work/teacher-grade.png`. Decision record: `docs/adr/0005-review-workbench.md`.

### Purpose

ดูโค้ดที่นักศึกษาส่ง + ผลตรวจ Test Case อัตโนมัติ + ให้คะแนนพิเศษ (bonus) + เขียน comment

### Layout

- **PageHead:** "ตรวจงาน" + คำบรรยาย "{ชื่อโจทย์} · {ชื่อวิชา}" + (ขวา) select **เลือกโจทย์**
- **กริด 3 คอลัมน์:** คิว `248px` / กลาง `1fr` / พาเนลให้คะแนน `320px`
  - <1280px → ซ่อนคอลัมน์คิว
  - <900px → ซ้อนแนวตั้ง

#### ซ้าย — คิวรายการส่ง (sticky)
- หัว "รายการส่งงาน · {จำนวน}"
- รายการนักศึกษาที่ส่ง: Avatar + ชื่อ + รหัส + Badge สถานะ (ตรวจแล้ว=เขียว / รอตรวจ=เหลือง)
- รายการที่เลือกอยู่ = พื้น blue-50 + แถบซ้าย

#### กลาง — โค้ด + ผลตรวจ
- **Code viewer (ธีมเข้ม):** เลขบรรทัด + โค้ด syntax highlight Python
- **การ์ด "ผลการตรวจอัตโนมัติ":** Badge "ผ่าน X/Y เคส"; รายการผลแต่ละเคส (ผ่าน=เขียว / ไม่ผ่าน=แดง); เวลา (ms) + คะแนน; เคสซ่อนมีป้าย "ซ่อน"

#### ขวา — พาเนลให้คะแนน (sticky)
1. หัว: Avatar + ชื่อ + รหัส + Badge สถานะ
2. meta: เวลาส่ง + ภาษา
3. **คะแนนอัตโนมัติ (Test Case):** ตัวเลขใหญ่ "auto/เต็ม" + progress bar
4. **คะแนนพิเศษ (Bonus):** stepper (ปุ่ม − / input / ปุ่ม +); ช่วง 0 → (pointsMax − auto)
5. **คะแนนรวม** = auto + bonus (กล่องพื้น blue-50, ตัวเลขใหญ่)
6. **ความคิดเห็นถึงนักศึกษา** (textarea)
7. ปุ่ม **"บันทึกผลการตรวจ"**

### Behavior

- เลือกนักศึกษาในคิว → เปลี่ยนโค้ด + ผล + พาเนลด้านขวา
- ปรับ stepper bonus → "คะแนนรวม" อัปเดตทันที
- กดบันทึก → เปลี่ยนสถานะเป็น reviewed, เก็บ `manual_score = auto + bonus`
- เลือกโจทย์อื่นจาก select บน → โหลดรายการส่งของโจทย์นั้น
- URL state: `?pid=&sid=`; Admin/Instructor only (ADR 0005)

### Implementation Notes

- Reuses `PUT /api/courses/.../problems/[pid]/submissions/[sid]` for saving review.
- `ReviewWorkbench` client component: `problems: ProblemListItem[]`, `courseSlug`.
- `SubmissionsTable` for per-problem submissions page.
- Effective score = `COALESCE(manual_score, points_earned)` — `manual_score` absorbs the combined auto + bonus value.

---

## PRD 08 · Student Assignments (งานที่ได้รับมอบหมาย)

> Status: Delivered

### Problem Statement

นักศึกษาต้องการดูรายการโจทย์ที่ได้รับมอบหมายในแต่ละสัปดาห์ พร้อมสถานะการส่งงานและคะแนนที่ได้รับ แต่หน้า Assignments เดิม:

- แสดงทุกสัปดาห์พร้อมกันโดยไม่มีตัวเลือกสัปดาห์
- ไม่แยกแยะระหว่าง "ส่งแล้วรอตรวจ" กับ "ตรวจแล้ว"
- Subtitle แสดง code/year/semester แทนชื่อวิชา
- ไม่มีปุ่ม "ทำโจทย์" ที่ชัดเจน

### Solution

ปรับหน้า Assignments ให้เป็น **week-scoped view** โดยมี WeekBar ให้นักศึกษาเลือกสัปดาห์ แสดงโจทย์ของสัปดาห์นั้นในรูปตาราง พร้อม status badge 4 สถานะและปุ่ม action ที่แตกต่างตามสถานะ

### User Stories

1. As a Student, I want to see a week selector bar, so that I can focus on problems for a specific week.
2. As a Student, I want the selected week to persist in the URL (`?week=N`), so that back button restores my week.
3. As a Student, I want to see the course name in the page subtitle.
4. As a Student, I want to see the week topic in the section header.
5. As a Student, I want a numbered index (ลำดับ) column for problems within the week.
6. As a Student, I want a green **"ตรวจแล้ว · N/M"** badge when my submission has been reviewed.
7. As a Student, I want a blue **"ส่งแล้ว · รอตรวจ"** badge when submitted but not yet reviewed.
8. As a Student, I want a yellow **"ยังไม่ส่ง"** badge when I have not submitted.
9. As a Student, I want a red **"หมดเวลา"** badge when the close date has passed and I have not submitted.
10. As a Student, I want a primary **"ทำโจทย์"** button for open, unsubmitted problems.
11. As a Student, I want an outline **"ดูงาน"** button for submitted problems.
12. As a Student, I want an outline **"ดูโจทย์"** button for closed, unsubmitted problems.
13. As a Student, I want the "คะแนนเต็ม" column to show the maximum score.
14. As a Student, I want the Effective Score shown inside the "ตรวจแล้ว" badge.
15. As a Student, I want a "ยังไม่มีงานในสัปดาห์นี้" empty row when a week has no problems.

### Implementation Decisions

- **Repository:** `getStudentAssignments(db, key, userId)` → `AssignmentItem[]`. Field `submission.reviewedAt` exposed (no schema change).
- **Page:** thin Server Component shell reads `searchParams.week`, passes `initialWeek` to client component inside `<Suspense>`.
- **Client component `AssignmentsList`:** fetches `/weeks` + `/assignments` on mount; filters client-side by `weekNo`; `WeekBar` with `canManage={false}`.
- **Status derivation:** pure function `deriveAssignmentStatus(item, now)` → `"reviewed" | "pending" | "not-submitted" | "closed"`, unit-tested.
- **Week URL state:** `?week=N` via `useSearchParams` + `useRouter`.
- **No new API routes:** reuses existing `/weeks` and `/assignments` endpoints.

### Testing Decisions

- `deriveAssignmentStatus` unit-tested (4 branches + edge cases).
- Repository: `reviewedAt` null for unreviewed, timestamp after `reviewSubmission`.

### Out of Scope

- Pagination of assignments.
- Late submission indicator ("ส่งช้า") — intentionally excluded.
- Instructor/TA view of this page.

---

## PRD 09 · Student Scorebook (สมุดคะแนนของฉัน)

> Status: Delivered

### Problem Statement

นักศึกษามีหน้า Assignments ที่บอกว่าต้องทำโจทย์อะไรบ้าง แต่ยังขาดมุมมองที่ตอบว่า **"ตอนนี้ฉันได้คะแนนไปเท่าไหร่แล้ว"** อย่างตรงไปตรงมา — ไม่มีหน้าสรุปคะแนนรวมของตัวเอง ไม่มีภาพรวมเชิงปริมาณ และหน้า Gradebook ของอาจารย์นักศึกษาเข้าไม่ได้

### Solution

เพิ่มหน้า **Scorebook (สมุดคะแนนของฉัน)** สำหรับนักศึกษา — มุมมองคะแนนของ **ตัวเองเท่านั้น** ราย Course แบ่งดูทีละสัปดาห์ผ่าน WeekBar แต่ละสัปดาห์มี:

- **Banner สรุป** — วงแหวน progress (donut SVG, no chart library) แสดง % คะแนนของสัปดาห์ที่เลือก + คะแนนรวม "X / Y คะแนน" + "ทำได้ a จาก b โจทย์"
- **ตารางคะแนน** — รายโจทย์ในสัปดาห์ พร้อมสถานะ คะแนนที่ได้ คะแนนเต็ม และแถวรวมท้ายตาราง

### User Stories

1. As a Student, I want to open "สมุดคะแนนของฉัน" from my sidebar.
2. As a Student, I want the page subtitle to show `{รหัสนักศึกษา} · {ชื่อ}`.
3. As a Student, I want to see only my own scores and never another student's.
4. As a Student, I want a WeekBar identical to the one on my Assignments page.
5. As a Student, I want the selected week to persist in the URL (`?week=N`).
6. As a Student, I want a summary banner with a progress ring (donut SVG) showing % for the selected week.
7. As a Student, I want the banner to show "X / Y คะแนน" in large text.
8. As a Student, I want the banner to show "ทำได้ a จาก b โจทย์".
9. As a Student, I want the banner to update when I switch weeks.
10. As a Student, I want a table with columns ลำดับ / ชื่อโจทย์ / สถานะ / คะแนนที่ได้ / เต็ม.
11. As a Student, I want a green **"ตรวจแล้ว"** badge when reviewed.
12. As a Student, I want a blue **"ส่งแล้ว · รอตรวจ"** badge when submitted, not yet reviewed.
13. As a Student, I want a yellow **"ยังไม่ส่ง"** badge when no submission (including past close date).
14. As a Student, I want "คะแนนที่ได้" to show Effective Score when a submission exists, else "–".
15. As a Student, I want a total row summing the week's earned and maximum points.
16. As a Student, I want the donut to count the auto-grade of not-yet-reviewed submissions.
17. As a Student, I want a 0% donut (not NaN) when a week has no points.
18. As a Student opening the page without an active Course, I want to be guided to pick a course.
19. As an Instructor or Admin, I do not need this page — the Scorebook lives only in the Student menu.

### Implementation Decisions

- **Scorebook** (สมุดคะแนนของฉัน) — single Student's own scores; counterpart to the staff **Gradebook**. See `CONTEXT.md`.
- **Effective Score** = `COALESCE(manual_score, points_earned)`. A submitted-but-unreviewed problem has an Effective Score (its auto-grade).
- **No new repository or API route.** Reuses `GET /api/courses/.../assignments` + `/weeks`.
- **Client component `ScoreList`:** mirrors `AssignmentsList` pattern; WeekBar `canManage={false}`; fetches `/weeks` + `/assignments` on mount; filters client-side.
- **Pure function `deriveScorebookSummary(weekItems)` → `{ earned, max, percent, solvedCount, totalCount }`** in `src/lib/scorebook/summary.ts`. Guards 0/0 → 0%.
- **Status badge:** reuses `deriveAssignmentStatus`; collapses `closed` + `not-submitted` → yellow "ยังไม่ส่ง" (3 states).
- **Routing (5 touch-points):** course-scoped page + legacy `/scorebook` redirector + `proxy.ts` matcher + Student sidebar menu + icon registry.
- **Page subtitle** fetches `getUserById` server-side for `{idCode} · {firstNameTh} {lastNameTh}`.

### Testing Decisions

- `deriveScorebookSummary` unit-tested (5 cases: empty, all-reviewed, pending auto-grade, no submission, rounding 57/70→81).
- `deriveAssignmentStatus` already covered; no new tests needed.

### Out of Scope

- Course-wide (all-weeks) total — banner is intentionally per-selected-week.
- Export (xlsx/PDF) of scorebook.
- Instructor/TA/Admin view of this page.
- Real-time updates when an instructor reviews a submission.
