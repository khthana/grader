# 6. Course Duplication: copy a whole offering into a new term

Date: 2026-06-24

## Status

Accepted

## Context

A Course is offered again every term — same `code`, new `(year, semester)` (ADR 0004).
Re-teaching means re-authoring every Week, Problem, Test Case, Code Policy, and
**Reference Solution** by hand, even though the content is nearly identical to the
previous term. There was no copy mechanism: every new offering started from six empty
Weeks.

Three things make naïve copying wrong:

1. **Deadlines belong to a calendar.** Copying `due_at` / `close_at` verbatim would make
   every Problem already past-deadline in the new term.
2. **Release state belongs to a term.** Copying `is_released` could expose unfinished
   content before the new term starts.
3. **Roster and grades belong to a cohort.** Enrollments and Submissions from the old
   term must not bleed into the new one.

## Decision

Add `duplicateCourseOffering(db, source: CourseKey, target: { year, semester }, actorId)`
in `src/lib/courses/duplicate.ts`, invoked by `POST /api/courses/[code]/[year]/[semester]/duplicate`
(`manage:true`, authorizes the **source** offering). The operation **creates** the target
offering — it must not already exist (409) — so the target is always empty and Week
mapping is unambiguous (no merge).

### What is copied

| Entity | Copied | Reset / excluded |
|--------|--------|------------------|
| Course | `nameTh`, `nameEn`, `program` | — |
| Course staff | `course_instructors` ∪ acting user | — |
| Week | `week_no`, `topic` | `is_released` → `false` (hidden) |
| Problem | all fields incl `reference_solution`, `problem_type`, `function_name`, `starter_code`, `unit_test_code`, `blacklist`, `whitelist` | `due_at` / `close_at` → `null` |
| Test Case | `input`, `expected_output`, `is_hidden`, `score`, `sort_order` | — |
| Enrollment | — | never copied |
| Submission | — | never copied |

Problems are copied in `(week_no, problem_no)` order so `createProblem`'s auto-assign
reproduces the source `problem_no`. The Reference Solution is read through the raw
`getReferenceSolution` — correct here because the copy runs server-side inside an
already-authorized `manage:true` route — and written server-side via `createProblem`, so
it never enters a student-reachable projection (the CONTEXT.md invariant holds). Request/
page paths instead use the gated `getReferenceSolutionForStaff`; see ADR 0007.

### Atomicity

The whole copy runs inside one transaction via a new `withTransaction(fn)` helper in
`src/lib/db.ts`, which checks out a single connection so `BEGIN`/`COMMIT`/`ROLLBACK`
apply to the same client. A failure midway leaves no partial offering. The
`same-as-source` and `target-exists` guards run **before any write**.

### No schema change

Duplication reuses existing tables. The only shared-validation change is extracting
`validateCourseOffering(year, semester)` from `validateCourseInput` so the route and
course create/edit share one year/semester rule.

## Consequences

**Positive**
- One click re-creates a term's content — grading behaves identically to the source.
- Creating (not merging into) the target keeps Week mapping trivial and avoids collisions.
- The staff-only Reference Solution invariant is preserved — the copy is entirely server-side.
- `withTransaction` is a reusable primitive for any future multi-step write.

**Negative / costs**
- The copy is N+1 by Problem (read detail + reference solution, write problem + test cases per Problem). Acceptable: it runs once per duplication, not on a hot path.
- Copying into an *existing* offering (merge/append) and selective copy are out of scope — only a fresh target is supported.
- Instructors must still release Weeks and set deadlines in the new term by hand (by design — those are term-specific).
