import type { AssignmentItem } from "@/lib/assignments/repository"

export interface ScorebookSummary {
  earned: number
  max: number
  percent: number
  solvedCount: number
  totalCount: number
}

export function deriveScorebookSummary(weekItems: AssignmentItem[]): ScorebookSummary {
  let earned = 0
  let max = 0
  let solvedCount = 0

  for (const item of weekItems) {
    earned += item.submission?.effectiveScore ?? 0
    max += item.pointsMax
    if (item.submission !== null) solvedCount++
  }

  const percent = max === 0 ? 0 : Math.round((earned / max) * 100)

  return { earned, max, percent, solvedCount, totalCount: weekItems.length }
}
