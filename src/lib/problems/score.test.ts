import { describe, it, expect } from "vitest"
import { problemMaxScore, testCaseScore, DEFAULT_TEST_CASE_SCORE } from "./score"

describe("testCaseScore", () => {
  it("uses the case's own score", () => {
    expect(testCaseScore(25)).toBe(25)
    expect(testCaseScore(0)).toBe(0)
  })

  it("falls back to the default when unset", () => {
    expect(testCaseScore(undefined)).toBe(DEFAULT_TEST_CASE_SCORE)
    expect(testCaseScore(null)).toBe(DEFAULT_TEST_CASE_SCORE)
  })
})

describe("problemMaxScore", () => {
  it("io mode: sum of all test-case scores, ignoring problem.score", () => {
    expect(
      problemMaxScore({
        problemType: "io",
        score: 10,
        testCases: [{ score: 5 }, { score: 20 }, { score: 5 }],
      })
    ).toBe(30)
  })

  it("io mode: unset case scores count as the default", () => {
    expect(
      problemMaxScore({ problemType: "io", score: 0, testCases: [{}, { score: 5 }] })
    ).toBe(DEFAULT_TEST_CASE_SCORE + 5)
  })

  it("io mode: a null case score is the default too, not 0 (#86 submissions page drift)", () => {
    expect(
      problemMaxScore({ problemType: "io", score: 0, testCases: [{ score: null }, { score: 5 }] })
    ).toBe(DEFAULT_TEST_CASE_SCORE + 5)
  })

  it("unit mode: the problem's own score (all-or-nothing)", () => {
    expect(
      problemMaxScore({ problemType: "unit", score: 40, testCases: [{ score: 5 }] })
    ).toBe(40)
  })
})
