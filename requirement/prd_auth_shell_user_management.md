# PRD — CE-Grader: Working Auth, Role-Based Shell & User Management

> Status: Ready for agent
> Scope owner: CE-Grader (Computer Engineering Python Grader), Faculty of Engineering, KMITL
> References (read-only inspiration, NOT build targets): `DEEP-QA-FRONTEND/`, `DEEP-QA-BACKEND/`

---

## Problem Statement

CE-Grader's login page looks finished but isn't actually usable: it redirects to a route (`/`) that doesn't exist, there is no route protection, no application shell (navbar/sidebar/breadcrumb), no way to manage who can log in, and its authentication is backed by two hard-coded in-memory users. As a CE staff member I can't onboard real instructors, TAs, or students, and as any user I have nowhere to land after signing in.

A separate, polished product — DEEP-QA — already solves the "sign in, see a role-based shell, manage users" problem with a working login, a navbar/sidebar/breadcrumb shell, and a User Management screen. CE-Grader should adopt that *look and feel and proven UX*, but as its own product with its own simpler domain.

## Solution

Make CE-Grader's login genuinely work, then build the authenticated experience around it — entirely inside the existing `grader/` Next.js app, reusing DEEP-QA only as a visual/UX reference.

From the user's perspective:

- I sign in with email/password (or Google) and land on a page appropriate to my role.
- I see a consistent shell on every page: a top navbar with the CE-Grader logo, a role switcher, and my profile menu; a collapsible sidebar whose menu reflects my role; and a breadcrumb trail.
- If I'm an Admin, I land on **User Management**, where I can list/search users, add them, edit their details, delete them, assign and revoke roles, bulk-import users from Excel, and review a user activity log.
- If I'm an Instructor or TA, I land on a teaching area with a sidebar for รายชื่อนักศึกษา · โจทย์ปัญหา · ตรวจงาน · สมุดคะแนน.
- If I'm a Student, I land on a student area with งานที่ได้มอบหมาย · สมุดคะแนน.
- The teaching/student pages are styled "coming soon" placeholders for now; **User Management is fully functional**.

## User Stories

### Authentication & session
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

### Shell — navbar, sidebar, breadcrumb
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

### Role-based landing & navigation
22. As an Admin, I want to land on User Management after login, so that I can get straight to administering accounts.
23. As an Admin, I want a sidebar that is a superset of all areas (User Management + รายชื่อนักศึกษา · โจทย์ปัญหา · ตรวจงาน · สมุดคะแนน), so that I can access everything.
24. As an Instructor, I want to land on the teaching area with a sidebar of รายชื่อนักศึกษา · โจทย์ปัญหา · ตรวจงาน · สมุดคะแนน, so that I can run my course.
25. As a TA, I want the same teaching sidebar as an Instructor, so that I can assist with the course.
26. As a Student, I want to land on the student area with งานที่ได้มอบหมาย · สมุดคะแนน, so that I can see my work and grades.
27. As a user, I want teaching/student menu items that aren't built yet to open clearly-labelled "coming soon" pages styled in the design system, so that the navigation is complete and the unfinished state is obvious.
28. As a signed-in user, I want the existing problem editor (`/problems/[id]`) to live inside the shell and behind authentication, so that it's consistent and protected.

### User Management (Admin) — full parity
29. As an Admin, I want a paginated, searchable table of all users, so that I can find any account.
30. As an Admin, I want to see each user's name, email, ID code, roles, and status in the table, so that I can assess accounts at a glance.
31. As an Admin, I want to add a new user with their Thai and English title/first/last name, email, phone, ID code, password, and role(s), so that I can onboard people.
32. As an Admin, I want validation when adding a user (required fields, valid email, password policy), so that I don't create broken accounts.
33. As an Admin, I want to edit a user's personal data, so that I can correct or update their details.
34. As an Admin, I want to assign and revoke roles for a user (Admin/Instructor/TA/Student), so that I can control their access.
35. As an Admin, I want to delete a user, with a confirmation step, so that I can remove accounts safely.
36. As an Admin, I want to activate/deactivate a user, so that I can disable access without deleting the record.
37. As an Admin, I want to bulk-import users from an Excel file using a template, so that I can onboard a class at once.
38. As an Admin, I want per-row error reporting on import (which row failed and why), so that I can fix and re-import only the bad rows.
39. As an Admin, I want to view a user activity log, so that I can audit what happened in the system.
40. As an Admin, I want user actions (create/update/delete/role change/login) recorded to the activity log, so that the audit trail is meaningful.

### Data & accounts
41. As an Admin, I want students to be ordinary users with the Student role (single users table), so that managing everyone happens in one place.
42. As an Admin, I want a user's ID code to be optional (รหัสนักศึกษา for students, staff ID otherwise), so that the field fits every kind of account.
43. As the system owner, I want a seeded Admin account on first setup, so that I can log in and create everyone else.

## Implementation Decisions

### Product & platform
- CE-Grader is a **standalone product**. `DEEP-QA-FRONTEND` and `DEEP-QA-BACKEND` are **read-only references** for look/feel and UX patterns only; no code is shared at runtime and nothing is built in those repos.
- All work happens inside the existing `grader/` app: **Next.js 16 (App Router) · TypeScript · Tailwind v4**.
- The shell and User Management are **reimplemented in plain Tailwind v4** + `react-icons`. **No MUI, no framer-motion, no react-router** are introduced. Dialogs, snackbars/toasts, and animations are small custom components (CSS transitions).

### Authentication
- Retain grader's existing **HMAC-signed session token in an HttpOnly cookie (8h)** and the already-implemented **Google OAuth code flow** (`/api/auth/google` + `/api/auth/callback/google`).
- Replace the in-memory user store with **Postgres-backed lookups**. Passwords are **bcrypt-hashed**; login compares against the hash.
- Email/password is the always-available path. Google activates once `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are provided; until then the existing graceful "not configured" handling stands.
- Add the missing pieces: a real **post-login landing**, a **logout endpoint**, a **profile/current-user endpoint**, and **Next.js middleware** that protects the authenticated route group, validates the session cookie, redirects unauthenticated users to `/login`, and redirects already-authenticated users away from `/login`.

### Roles & authorization
- Four roles: **Admin / Instructor / TA / Student**, related to users **many-to-many** (`user_roles`).
- **Admin is a superset** and can access every area; lands on User Management.
- Instructor and TA share the teaching sidebar; Student gets the student sidebar.
- A **role-resolution module** maps a role to: its sidebar menu config, its default landing route, and (for User Management) its assignable roles. The navbar **role switcher** is populated from the signed-in user's assigned roles and drives the active-role context.

### Routing & shell structure
- Authenticated pages live under a **route group with the shell as its layout** (navbar + collapsible sidebar + breadcrumb + toast host). The existing `/problems/[id]` editor moves under this group and behind auth.
- The **breadcrumb** is derived from the current pathname via a Thai label map (pure function).
- Teaching/student feature pages (รายชื่อนักศึกษา, โจทย์ปัญหา, ตรวจงาน, สมุดคะแนน, งานที่ได้มอบหมาย) render **styled "coming soon" placeholders** this iteration. Only **User Management** is functional.

### Data layer (Postgres, raw `pg` + SQL)
- DB access is **raw `pg` with hand-written SQL** (mirroring DEEP-QA-BACKEND's style), exposed through a small **User repository** module. Connection via `DATABASE_URL`. Ship a `schema.sql` and a seed (including the initial Admin).
- **Single `users` table**: a student is a user with the Student role; the future roster is a filtered view.
- User fields: title/first/last name in **Thai and English**, email, phone, **bcrypt password hash**, **ID code (nullable)**, profile picture, `is_active`, created/updated timestamps.
- Tables: `users`, `roles`, `user_roles`, `user_logs` (activity audit).

### User Management — full parity feature set
- Paginated/searchable user table; add user; edit personal data; delete (with confirm); assign/revoke roles; activate/deactivate.
- **Excel import**: introduces the `xlsx` library, an import dialog, parsing + per-row validation, and per-row error reporting.
- **Activity log**: `user_logs` written on create/update/delete/role-change (and login), with an Admin-facing log view.

### API contracts (shape, not paths)
- **Auth**: login (email/password → sets session cookie), logout (clears cookie), Google start + callback (existing), current-user/profile (returns the signed-in user + roles).
- **Users**: list (search + pagination), get one, create, update personal data, delete, assign/revoke role, set active status, bulk import (accepts parsed rows, returns per-row results).
- **Logs**: list user activity (paginated/filterable).

## Testing Decisions

A good test exercises **external, observable behavior** through a module's public interface — given these inputs/requests, this response/state — and does **not** assert on internal implementation details, private helpers, SQL text, or component markup structure. Tests should survive refactors that preserve behavior.

Modules to test (deep modules with simple, stable interfaces):

- **Session token module** (`lib/auth`): `createSessionToken` → `verifySessionToken` round-trips; rejects tampered signatures, malformed tokens, and expired payloads. Pure and already isolated — highest-value unit tests.
- **Password hashing/verification**: a correct password verifies, an incorrect one fails, hashes are salted/non-deterministic.
- **Role-resolution module**: a given role maps to the expected landing route, sidebar config, and assignable-role set; Admin resolves as the superset.
- **Breadcrumb derivation**: a pathname maps to the expected ordered crumbs with Thai labels, including unknown/encoded segments.
- **xlsx import parser/validator**: a well-formed sheet yields valid rows; malformed rows yield precise per-row errors (missing required field, bad email, duplicate email, unknown role) without aborting the whole import.
- **User repository** (integration, against a test Postgres or a thin seam): create/read/update/delete and role assign/revoke behave as specified; uniqueness on email is enforced.

Prior art: none exists in `grader/` yet (no test setup). Establish the first test harness here; favor fast unit tests for the pure modules (session, roles, breadcrumb, import validation) and a small integration layer for the repository.

The user will confirm which of these modules they want tests written for in this iteration.

## Out of Scope

- Real implementations of the teaching/student features: รายชื่อนักศึกษา (roster), โจทย์ปัญหา (problem authoring/list), ตรวจงาน (grading/review), สมุดคะแนน (gradebook), งานที่ได้มอบหมาย (assigned work). These are **styled placeholders** only.
- Courses/sections/enrollment modeling (needed later to scope rosters and gradebooks).
- The grading engine and submissions domain beyond the **existing** `/problems/[id]` editor and `/api/grade` (which are merely moved under the shell and protected).
- Forgot-password / password-reset email flows, and the in-navbar change-password feature from DEEP-QA (the "ไปที่ Deep Portfolio" cross-product link is intentionally **dropped**).
- The full DEEP-QA role model (FACULTY_ADMIN, DEPT_ADMIN, PROG_MANAGER, GUEST, etc.) and its department/program/PLO scope concepts.
- Production database provisioning/ops (a running Postgres reachable via `DATABASE_URL` is assumed to be supplied).
- Any code changes in `DEEP-QA-FRONTEND/` or `DEEP-QA-BACKEND/`.

## Further Notes

- The login **UI** is already built and already uses the CE-Grader/DEEP-QA design system; the work is wiring, persistence, the shell, route protection, and User Management — not redesigning login.
- Google OAuth and Postgres can remain unconfigured during development: the app must stay runnable on email/password against a seeded Admin, degrading gracefully when Google creds or the DB are absent.
- Design system source of truth: `grader/requirement/design.md`; login behavior spec: `grader/requirement/login_spec.md`.
- Drop DEEP-QA-specific shell behaviors when porting: the cross-product portfolio link, and the `scope_id`/`FULL_ADMIN` role-fetch pattern.
