// Assessment Components (#101) — name / weight % / note, a statement only:
// the Gradebook and Scorebook never weight or combine scores by it. The one
// rule for the total and for "is it 100%", so the editor and the view agree.

export interface AssessmentComponent {
  name: string
  weight: number
  note: string
}

export const MAX_WEIGHT = 100

/** 0–100 with at most two decimals (the column is NUMERIC(5,2)). */
export function isWeight(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_WEIGHT &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
  )
}

/** The sum of the weights, rounded to two decimals (so 0.1 + 0.2 reads 0.3). */
export function assessmentTotal(components: { weight: number }[]): number {
  const cents = components.reduce((sum, c) => sum + (Number.isFinite(c.weight) ? Math.round(c.weight * 100) : 0), 0)
  return cents / 100
}

/** The total is exactly 100% — tolerant of floating-point error. */
export function isComplete(total: number): boolean {
  return Math.abs(total - 100) < 0.005
}
