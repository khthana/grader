// Per-student Scorebook Status — a worst-state-wins rollup of a student's
// submission situation across all problems in a course (see ADR 0003).
export type ScorebookStatus = "complete" | "late" | "missing" | "none-due"

export interface ScorebookStatusInput {
  problems: { id: number; dueAt: string | null }[]
  scores: Record<number, number | null> // problemId -> effective score, or null when not submitted
  lateByProblem: Record<number, boolean> // problemId -> latest submission's is_late
  now: Date
}

export function deriveScorebookStatus(input: ScorebookStatusInput): ScorebookStatus {
  const { problems, scores, lateByProblem, now } = input

  let anyDuePassed = false
  let missing = false
  let late = false

  for (const p of problems) {
    const submitted = scores[p.id] != null
    const isDue = p.dueAt != null && new Date(p.dueAt) <= now

    if (isDue) anyDuePassed = true
    if (isDue && !submitted) missing = true
    if (lateByProblem[p.id]) late = true
  }

  if (missing) return "missing"
  if (late) return "late"
  return anyDuePassed ? "complete" : "none-due"
}
