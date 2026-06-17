# 3. Scorebook Status: per-student 4-state rollup

Date: 2026-06-17

## Status

Accepted

## Context

The Scorebook (สมุดคะแนนรวม) shows every Student × every Problem in a Course.
Instructors asked for an at-a-glance signal per student — "who is behind?" —
without scanning every cell. The per-Submission states already exist from the
two-tier deadline (ADR 0002): a submission is on-time, late (`is_late`), or
blocked. What was missing was a **per-student rollup across all Problems** in the
Course.

## Decision

Each Student carries a single **Scorebook Status**, derived from each Problem's
**Due Date** (`due_at`) and each Submission's `is_late` flag, evaluated against
"now". Four states, **worst-state-wins** (priority red > yellow > green > grey):

- **red — ค้างส่ง (missing):** ≥1 problem whose `due_at` has passed with no
  submission from this student.
- **yellow — ส่งช้า (late):** no missing work, but ≥1 of the student's
  submissions has `is_late = true`.
- **green — ส่งครบ (complete):** every problem currently due has an on-time
  submission; nothing missing, nothing late.
- **grey — ยังไม่ถึงกำหนด (none-due):** no problem has reached its `due_at` yet,
  or the Course has no problems — nothing can be late or missing.

A problem with `due_at = NULL` (no soft deadline) is never "missing" — it cannot
push a student to red. A late submission against it would still count toward
yellow via `is_late`, but in practice `is_late` is only set when a deadline was
passed, so a NULL-due problem stays neutral.

The derivation lives in a pure module (`deriveScorebookStatus`) with no DB
dependency, so it is unit-tested in isolation. The gradebook repository computes
the inputs (each problem's `due_at`; each student's latest submission per problem
and its `is_late`) and calls the pure function, attaching the result to each
student. Effective score remains `COALESCE(manual_score, points_earned)`.

## Consequences

**Positive**
- One dot per student summarises the whole course — the core ask.
- Builds directly on ADR 0002: the same on-time / late / blocked semantics,
  rolled up rather than re-derived.
- Pure derivation is cheaply and exhaustively unit-tested; the repository test
  only needs to confirm the wiring.

**Negative / costs**
- "now" is evaluated server-side at request time, so the status is a snapshot —
  a problem crossing its `due_at` flips a student from grey/green to missing on
  the next load, with no event.
- A student who submits everything early still reads as grey (none-due) until a
  deadline actually passes; "complete" requires at least one problem to be due.
- No per-student deadline extension is modelled (same limitation as ADR 0002).
