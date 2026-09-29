# 10. Deepen Problem authoring, visibility and deadlines into single-rule modules

Date: 2026-09-29

## Status

Accepted. Extends ADR 0007 and refines ADR 0002.

## Context

A second architecture review (2026-09-29) found the same pattern ADR 0007 fixed for
grading: several rules about a **Problem** were written in more than one place, so
callers could disagree, and one of the gaps was a real security bug. Each rule is now a
small module with one definition, and callers ask it instead of writing the rule inline:

1. **Week-release gate (#82).** "Can this viewer see this Problem's Week?" was
   hand-written in the problem page, `[pid]` GET, `/api/grade` and the legacy id
   redirectors.
2. **Problem create vs edit (#83).** POST and PUT each validated the raw request body.
   PUT validated an omitted `problemType` as io while saving the stored unit type.
3. **Cross-course Week (#88, security).** The single-column `week_id` FK accepted any
   course's Week, so a manager of course A could plant a Problem in course B's Week.
   B's students then saw it on the problem page.
4. **Problem Type × language (#86).** "Unit mode needs Python" and "AI generation is
   Python-only" were checked separately in validation, the generate route and the
   editor. The generate route didn't check at all, so it accepted a C course.
5. **Reference verification (#85).** "รันเฉลย" had its own pass rule (exit 0 **and**
   empty stderr). A Reference Solution that printed a warning showed 🔴 in the editor,
   although grading passed it.
6. **What a Student may see (#84).** Hiding hidden Test Cases, the Unit Test Code and
   unit tracebacks was done in 6 places across 5 modules. That included grading
   (`redactForStudent`), even though ADR 0007 says grading knows nothing about auth,
   and the Piston adapter.
7. **Submission Window (#87).** open/late/closed was computed in three places, each
   with its own `new Date()`. The Assignments badge used `<=` while the grade route
   used `<`.

## Decision

| Rule | Module | Callers |
|---|---|---|
| Week-release gate | `src/lib/problems/problem-access.ts`: `canSeeWeek(access, week)`; `resolveProblemVisibility(db, user, id)` → `visible` / `not-found`. "Unknown id", "not linked" and "unreleased" are one kind, so they can't be told apart. | problem page, `[pid]` GET, `/api/grade`, legacy redirectors |
| Problem Draft | `src/lib/problems/draft.ts`: `buildProblemDraft(body, { language, existing? })` merges the body over defaults or over the stored Problem, validates the **merged** Problem and returns exactly what gets written. A wrong-typed field is a 400. | problem POST/PUT; duplication shares `toTestCaseInput` |
| Week ownership | POST checks `getWeekForCourse`. `createProblem` itself throws on a foreign Week. `getProblemByWeekAndNo(db, key, …)` is course-scoped. | problem POST; the 3 `problems/[week]/[no]` pages |
| Problem Type capabilities | `src/lib/problems/problem-type.ts`: `isProblemTypeAllowed(type, language)`, `canGenerateTests(type, language)`, `isProblemType`. | validation, generate route, run-reference route, ProblemEditor |
| Reference verification | `verifyReferenceSolution(draft, language, runner)` in `src/lib/grading` runs through the grading `CodeRunner`. `ok = !TestResult.errored`, and the runner sets `errored`. `getCodeRunner` / `setTestRunner` is the test seam. | run-reference route |
| Student View | `src/lib/problems/student-view.ts`: `problemFor(viewer, problem)`, `gradeResultFor(viewer, result, problem)`, `sampleTestCases(problem)`. `viewer` is the viewer's **course** access `{ staff }`. | `[pid]` GET, `/api/grade`, problem page |
| Submission Window | `src/lib/problems/submission-window.ts`: `submissionWindow({ dueAt, closeAt }, now)` → `"open" \| "late" \| "closed"`, with `now` injected. | grade route, problem page, `deriveAssignmentStatus` |

Rules for the Student View:

- Staff get everything unchanged. A Student's result shows output only for a
  **visible** io case.
- The io compile failure keeps its gcc error (the student's own code) and shows no
  output.
- Anything else is withheld to pass/fail (`hidden: true`): a hidden case, the unit
  block, or an unknown id. It fails closed.
- Grading returns full results only. The stored Submission keeps everything for staff.
- The whole-program result id is one constant, `PROGRAM_RESULT_ID`.

## Consequences

**Positive**
- Each rule has one home and one table-driven or matrix test. A new caller asks the
  module instead of repeating the rule, which is how #71, #79 and #88 happened.
- ADR 0007's "grading knows nothing about auth" holds again: redaction left grading
  and the Piston adapter.
- The editor's ✅/⚠️/🔴 can no longer disagree with grading. A pin test runs both
  through the real `pistonRunner` with Piston stubbed.
- The deadline rule is testable without faking the clock. The page, the route and the
  badges agree at the exact deadline instant.

**Negative / costs**
- The #88 fix is enforced in code, not by the schema. A composite FK `(week_id,
  course…)` would make it structural and was left as a separate decision. Rows
  planted before the fix need a manual check (query in the #88 commit; the dev DB
  had none).
- `/api/grade` tests still mock `@/lib/piston` instead of using `setTestRunner`.
- `CodeEditor` still decides on the client how to render a withheld result, from
  `r.hidden` and `problemType`.
- `gradebook/status.ts` (ADR 0003 "any due passed") keeps its own `<=` comparison. It
  is a different concept (a status rollup, not whether a Problem accepts
  Submissions), so it is deliberately left out of the Submission Window.

**No schema change.**
