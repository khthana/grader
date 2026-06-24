# 7. Deepen grading into a module; scope reads by CourseKey

Date: 2026-06-24

## Status

Accepted

## Context

An architecture review (`/improve-codebase-architecture`) surfaced four "deepening"
opportunities — places where behaviour that belongs in one deep module was spread thin
across route handlers, or where an invariant was held by convention rather than shape.
None were defects; the code worked and the suite was green. The concern was locality and
leverage:

1. **Grading lived in the route.** `POST /api/grade` was a 141-line handler that inlined
   Code Policy, io/unit dispatch, and per-Test-Case scoring. `pointsMax` was computed in
   **three** places. Testing grading meant going through HTTP.
2. **Problem/Week ownership was re-checked by hand.** Every staff handler did
   `getProblemById(db, id)` then a hand-written CourseKey comparison (`ownsProblem`,
   duplicated across `problems/[pid]` ×3 and `generate` ×1). The week **PUT** handler
   skipped the check entirely — mutating by `weekId` with no course scope, a cross-course
   write leak.
3. **The Reference Solution staff-only rule was documentation, not structure.** The read
   was a plain function each caller had to remember to gate.
4. **The Piston seam leaked.** Grading imported the HTTP module directly, so it could not
   be tested without mocking the module / network.

## Decision

### Grading is a deep module (candidate #1)

`src/lib/grading/index.ts` exports `gradeSubmission(problem, code, mode, runner?) →
GradeResult`. It owns Code Policy → io/unit dispatch → per-Test-Case scoring → the
**single** `pointsMax` computation, and nothing else. `POST /api/grade` is now a thin
orchestrator: auth · deadline (`close_at`) · enrollment · call `gradeSubmission` · persist.

A code-policy violation is **not** a graded attempt: `gradeSubmission` returns
`policyViolations` on the `GradeResult`, and the route skips persisting a Submission when
it is present — preserving the pre-refactor behaviour where the route returned before the
persist block.

### The Piston seam is an injectable adapter (candidate #4)

Grading depends on a `CodeRunner` interface (`runTestCases` / `runUnitTestBlock`), not on
the HTTP module. `pistonRunner` is the default real adapter; tests inject a **fake runner**
(no network, no module mocking) — the second adapter that earns the seam. The LLM seam was
left as-is: it is already a single function with its own error type, a fetch-mocking test,
and no second consumer, so a parallel abstraction would be ceremony.

### Reads carry their course scope (candidate #2)

`getProblemForCourse(db, key, id)` and `getWeekForCourse(db, key, weekId)` fold the
ownership check into the query — they return `null` unless the row belongs to the
CourseKey. Staff handlers use these instead of `getProblemById` + a comparison; the four
`ownsProblem` copies are deleted, and the week PUT leak is closed (a foreign week is now a
404).

### The Reference Solution gate rides the read (candidate #3)

`getReferenceSolutionForStaff(db, id, roles) → { ok: true; solution } | { ok: false;
reason: "forbidden" }` checks `canManageCourses` before returning the value. Request/page
paths (the Problem edit page) read through it. The raw `getReferenceSolution` stays
auth-free — consistent with every other repository function, where auth lives at the
route/page layer — and is reserved for trusted server-side orchestration already behind a
`manage:true` route (course duplication). This is a convention strengthened by an obvious
gated entry, not full structural enforcement: the raw read remains exported, so the
duplication path can use it without threading roles through `duplicateCourseOffering`.

## Consequences

**Positive**
- Scoring rules and `pointsMax` have one home; the route absorbs nothing.
- Grading is unit-testable through one interface with a fake runner — no HTTP.
- Cross-course reads/writes are structurally impossible for Problems and Weeks; a real
  week-PUT leak is fixed (with a regression test).
- New request/page callers reaching for the Reference Solution find a gated function first.

**Negative / costs**
- `GradeResult` gained an optional `policyViolations` field that only the grade route
  reads — a small leak of "why" into the result shape, accepted to keep the policy
  decision inside the deep module.
- The Reference Solution invariant is enforced by convention + an obvious gated wrapper,
  not by removing the raw read. Threading `roles` into `duplicateCourseOffering` would
  close that gap at the cost of coupling the copy orchestration to the role model — judged
  not worth it while duplication is already behind `manage:true`.

**No schema change.** Pure refactor: 462 tests / 63 files, existing `grade/route.test.ts`
passes unedited (behaviour-preservation proof), plus new tests for the grading module
(fake runner), `getProblemForCourse`, `getReferenceSolutionForStaff`, the week-PUT
cross-course 404, and the submit-violation no-persist case.
