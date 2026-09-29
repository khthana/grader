import type { ProblemType } from "./problem-type"

// The single rule for a Problem's max score (#66). io mode: the sum of every
// Test Case's score (PRD-unit-test-blacklist #26). Unit mode is all-or-nothing,
// so the max is the problem's own score. Grading, the problem page, and the
// problem save path all go through here so the numbers can't drift apart.

export const DEFAULT_TEST_CASE_SCORE = 10

export function testCaseScore(score?: number | null): number {
  return score ?? DEFAULT_TEST_CASE_SCORE
}

export function problemMaxScore(problem: {
  problemType: ProblemType
  score: number
  testCases: Array<{ score?: number | null }>
}): number {
  if (problem.problemType === "unit") return problem.score
  return problem.testCases.reduce((sum, tc) => sum + testCaseScore(tc.score), 0)
}
