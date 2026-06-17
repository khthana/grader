# 2. Two-tier deadline: due_at (soft) + close_at (hard)

Date: 2026-06-17

## Status

Accepted

## Context

Problems need a deadline. A single deadline forces a binary choice: accept or block.
Instructors wanted to distinguish between "submitted on time", "submitted late (still
accepted)", and "submission window closed" — three distinct states.

## Decision

Every Problem carries two optional `TIMESTAMPTZ` columns:

- **`due_at`** — soft deadline. Submissions after this are accepted but flagged
  `is_late = true` on the Submission row. Instructors can filter late submitters.
  If NULL, there is no soft deadline.

- **`close_at`** — hard cutoff. `/api/grade` rejects submissions after this with
  HTTP 403. If NULL, the submission window never closes (only the soft late-flag
  applies). `close_at` should always be ≥ `due_at` when both are set; validated
  server-side.

Effective score uses `COALESCE(manual_score, points_earned)` so an Instructor can
override a late submission's grade without changing the `is_late` flag.

## Consequences

**Positive**
- Three clearly named states: on-time / late / blocked — matches how most courses work.
- Instructors can run a course with only a soft deadline (close_at = NULL) and never
  block submissions, or add a hard cutoff per-problem.
- `is_late` on the Submission row lets the gradebook surface late work without re-deriving
  it from timestamps.

**Negative / costs**
- Two deadline fields to fill in the Problem Editor (both optional, so UX impact is low).
- Server must check both fields in `/api/grade`; order matters (`close_at` checked first).
- No grace-period or per-student extension in v1 — a future extension if needed.
