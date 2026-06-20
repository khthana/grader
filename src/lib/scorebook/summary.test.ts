import { describe, it, expect } from "vitest"
import { deriveScorebookSummary } from "./summary"
import type { AssignmentItem } from "@/lib/assignments/repository"

function makeItem(
  pointsMax: number,
  effectiveScore: number | null
): AssignmentItem {
  return {
    problemId: 1,
    problemNo: 1,
    title: "Test Problem",
    weekNo: 1,
    dueAt: null,
    closeAt: null,
    pointsMax,
    submission:
      effectiveScore !== null
        ? {
            pointsEarned: effectiveScore,
            manualScore: null,
            effectiveScore,
            isLate: false,
            submittedAt: "2026-06-01T00:00:00Z",
            reviewedAt: null,
          }
        : null,
  }
}

describe("deriveScorebookSummary", () => {
  it("returns all zeros for an empty week with no NaN", () => {
    const result = deriveScorebookSummary([])
    expect(result).toEqual({ earned: 0, max: 0, percent: 0, solvedCount: 0, totalCount: 0 })
    expect(Number.isNaN(result.percent)).toBe(false)
  })

  it("computes correct values when all problems are reviewed", () => {
    const items = [makeItem(10, 8), makeItem(10, 10), makeItem(10, 5)]
    expect(deriveScorebookSummary(items)).toEqual({
      earned: 23,
      max: 30,
      percent: 77,
      solvedCount: 3,
      totalCount: 3,
    })
  })

  it("counts a pending submission's auto-grade in earned and percent", () => {
    const pending: AssignmentItem = {
      ...makeItem(10, 7),
      submission: {
        pointsEarned: 7,
        manualScore: null,
        effectiveScore: 7,
        isLate: false,
        submittedAt: "2026-06-01T00:00:00Z",
        reviewedAt: null,
      },
    }
    expect(deriveScorebookSummary([pending])).toEqual({
      earned: 7,
      max: 10,
      percent: 70,
      solvedCount: 1,
      totalCount: 1,
    })
  })

  it("problem with no submission contributes 0 to earned, points to max, excluded from solvedCount", () => {
    const items = [makeItem(10, 8), makeItem(10, null)]
    expect(deriveScorebookSummary(items)).toEqual({
      earned: 8,
      max: 20,
      percent: 40,
      solvedCount: 1,
      totalCount: 2,
    })
  })

  it("rounds percent correctly (57/70 → 81)", () => {
    const items = [makeItem(40, 30), makeItem(30, 27)]
    expect(deriveScorebookSummary(items)).toEqual({
      earned: 57,
      max: 70,
      percent: 81,
      solvedCount: 2,
      totalCount: 2,
    })
  })
})
