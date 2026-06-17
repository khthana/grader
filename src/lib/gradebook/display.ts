// Pure presentation helpers for the Scorebook table.

export type ScoreTier = "empty" | "hi" | "mid" | "lo"

// Classify a per-problem score into a colour tier by its ratio to the problem's
// max points: hi ≥80%, mid ≥50%, lo <50%, empty when not submitted.
export interface Page<T> {
  pageItems: T[]
  pageCount: number
  page: number
}

// Slice a list into a page. pageCount is always ≥ 1; an out-of-range page is
// clamped into [1, pageCount].
export function paginate<T>(items: T[], page: number, perPage: number): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / perPage))
  const clamped = Math.min(Math.max(page, 1), pageCount)
  const start = (clamped - 1) * perPage
  return {
    pageItems: items.slice(start, start + perPage),
    pageCount,
    page: clamped,
  }
}

export function scoreTier(score: number | null, pointsMax: number): ScoreTier {
  if (score === null) return "empty"
  // A degenerate 0-point problem counts a submission as full marks.
  const ratio = pointsMax > 0 ? score / pointsMax : 1
  if (ratio >= 0.8) return "hi"
  if (ratio >= 0.5) return "mid"
  return "lo"
}
