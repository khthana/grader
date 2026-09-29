// Submission Window (ADR 0002, #87): the one rule for whether a Problem still
// takes Submissions. `close_at` is checked first — past it, submitting is
// refused; past `due_at` (but not `close_at`), a Submission is accepted and
// marked late. A deadline is "past" only strictly after its instant; a null
// deadline never passes. `now` is injected: read it once per request and pass
// it to every decision, so the page and the grade route can't disagree.
export type SubmissionWindow = "open" | "late" | "closed"

export function submissionWindow(
  problem: { dueAt: string | null; closeAt: string | null },
  now: Date
): SubmissionWindow {
  const isPast = (deadline: string | null) => deadline !== null && new Date(deadline) < now
  if (isPast(problem.closeAt)) return "closed"
  if (isPast(problem.dueAt)) return "late"
  return "open"
}
