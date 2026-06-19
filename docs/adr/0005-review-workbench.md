# 5. Review Workbench: 3-column layout, URL state, bonus stepper

Date: 2026-06-19

## Status

Accepted

## Context

The `/review` page previously used `PendingQueue` — a flat list of all
unreviewed submissions across all problems, sorted oldest-first. Instructors
found it hard to work with: no way to focus on one problem, no code visibility
without clicking through to a separate page, and no way to adjust a grade once
a submission was reviewed.

The redesign (spec: `requirement/work/06-teacher-grade.md`) asked for an
in-page grading experience — code visible alongside the grade controls — and
the ability to give a bonus on top of the auto-grade.

Three non-obvious design decisions were resolved during the grill session:

1. **What problem/submission to show** — path params vs. query params.
2. **Which problem to default to** when landing without params.
3. **How to model "bonus"** — the spec says `final = auto + bonus`, but the
   schema has only `manual_score`, not a separate bonus column.

## Decisions

### 1. URL state via query params (`?pid=&sid=`)

`/review?pid=42&sid=7` — both the selected problem and selected submission live
in the query string, not the path.

Alternatives considered:
- **Path params** (`/review/42/7`): would require nested routes and a new
  layout, adding complexity with no benefit.
- **Component state only** (no URL): the page refreshes on navigation lose the
  selection; teachers cannot share or bookmark a specific submission.

Query params are handled entirely client-side via `useSearchParams()` /
`useRouter().push()`. The server page only reads `?pid` to decide the default
redirect; it does not read `?sid`.

### 2. Default problem: first problem that has any submission

On landing at `/review` (no `?pid`), the server redirects to
`/courses/…/review?pid=X` where X is the first problem (by `listProblems` order)
that has at least one submission. Falls back to `problems[0]` if no submissions
exist at all. This is computed via `getProblemIdsWithSubmissions` in a single
`DISTINCT problem_id` query run in parallel with `listProblems`.

Alternative: default to first pending (unreviewed) problem. Rejected because
a fully-reviewed problem is still useful to revisit (grade overrides), and
"first with any submission" is simpler and more predictable.

### 3. Bonus stepper saves as `manualScore = auto + bonus`

The spec calls for an additive bonus on top of the auto-grade score. The DB
has no separate bonus column — `submissions.manual_score` replaces the
auto score when set. The UI resolves this by:

- Displaying `bonus = effectiveScore − auto` when opening a reviewed submission
  (so existing overrides round-trip correctly).
- Capping the bonus at `pointsMax − auto` (so `manualScore` never exceeds
  `problem.score`).
- On save: `PUT { manualScore: auto + bonus }`.

The PUT route already validates `manualScore ∈ [0, problem.score]`, which holds
because all-or-nothing scoring means `auto` is always 0 or `pointsMax`.

No schema migration. The `COALESCE(manual_score, points_earned)` effective-score
formula is unchanged.

## Consequences

**Positive**
- Teachers stay on one page for the whole review flow: pick problem → pick
  student → read code → adjust grade → save.
- URL state means a specific submission is shareable and survives a reload.
- No schema change: bonus is UI sugar on top of the existing `manual_score`.

**Negative / costs**
- `PendingQueue` component (`src/components/review/PendingQueue.tsx`) is now
  unused — the new workbench fetches all submissions per problem, not a
  cross-problem pending list. The component is kept but orphaned.
- The submission queue shows all submissions for a problem (not just pending),
  so a fully-graded problem still appears in the queue; the teacher must look
  at the badges to find remaining work.
- Browser UI was not verified against a running dev server at implementation
  time — CodeMirror's dynamic import and the `?pid` redirect are the two paths
  most likely to surface runtime issues first.
