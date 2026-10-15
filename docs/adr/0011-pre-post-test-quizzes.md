# 11. Pre/Post-test Quizzes: one Quiz, two rounds, per-Group windows

Date: 2026-10-15

## Status

Accepted

## Context

Instructors run a multiple-choice Pre-test before a topic and the same test again
afterwards (Post-test) to measure learning. Until now they did it in Google Forms
(`W01_Pretest_GoogleForm.gs`), so the results lived outside CE-Grader and Pre and
Post could not be compared question by question. A course can have several Groups
that meet at different times, and each Group sits the test in its own class period.

## Decision

1. **A Quiz is its own domain, not a kind of Problem.** It has no code, no Piston,
   no Test Cases and no Submission Window. Its scores never enter the Gradebook or
   Scorebook, because Pre/Post measure learning and are not graded coursework.
   Bending `problems` / `submissions` to hold multiple-choice answers would have
   pushed every Problem rule (ADR 0010) into "unless it's a quiz" branches.
2. **One Quiz, two Quiz Rounds (Pre, Post), one set of questions.** Pre-test and
   Post-test are not two Quizzes that copy questions. Comparability is the point,
   so the questions are stored once. A Quiz is **locked** once any Attempt exists,
   so edits can't change what one round asked and not the other.
3. **The Round Window is two instants per (Quiz, Round, Group). There is no
   open/closed flag.** The state (not yet open / open / closed) comes from
   `opens_at` / `closes_at` and the clock, the same way the Submission Window does
   (ADR 0010). "Open now" / "close now" just write `now`. If we stored a flag as well,
   it could disagree with a schedule. Windows are set **per Group** because Groups
   sit the test at different times. Students with no Group share one window. Pre and
   Post of the same Group must not overlap. There are no per-student overrides; the
   instructor moves the student to a different Group instead.
4. **Auto-submit is derived, not scheduled.** An Attempt counts as submitted when the
   Student submits it, or once its Group's window has closed. The answers saved by
   then count. No background job runs at `closes_at`.
5. **The answer key is withheld until the Group's Post window has closed.** Both
   rounds ask the same questions. Showing correct choices or explanations after Pre,
   or after one Student's Post while classmates are still answering, would
   contaminate the Post result. Until then a Student sees only their score and
   correct / wrong / don't-know per question. One module decides this, in the same
   spirit as the Student View (ADR 0010).

## Considered Options

- **Quiz as a Problem type.** Rejected: see (1).
- **Separate Pre and Post Quizzes with copied questions.** Rejected: the questions
  drift apart, and comparing per question needs a mapping.
- **A manual `is_open` toggle plus an optional schedule.** Rejected: two sources of
  truth (see 3).
- **A per-attempt countdown timer.** Deferred: in-class sittings are bounded by the
  window. The window can carry a timer later without a model change.

## Consequences

- The Week a Quiz is tied to is a label only. A Quiz ignores Week release, because a
  Pre-test runs before its Week is released.
- If a Post window is never set, the answer key is never released. That is
  intentional: the instructor closes Post to release it.
- Course Duplication copies Quizzes (unlocked) but not windows or attempts.
