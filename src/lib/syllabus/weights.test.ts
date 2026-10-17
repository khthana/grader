import { describe, it, expect } from "vitest"
import { assessmentTotal, isComplete, isWeight } from "./weights"

const w = (...weights: number[]) => weights.map((weight) => ({ weight }))

describe("Assessment Component weights (#101)", () => {
  it.each([
    [w(30, 30, 30, 10), 100, true],
    [w(30, 30, 30, 9.99), 99.99, false],
    [w(0.1, 0.2, 99.7), 100, true],
    [w(33.33, 33.33, 33.34), 100, true],
    [w(60, 50), 110, false],
    [[], 0, false],
  ])("%j totals %d (complete: %s)", (components, total, complete) => {
    expect(assessmentTotal(components)).toBe(total)
    expect(isComplete(assessmentTotal(components))).toBe(complete)
  })

  it("the raw float sum would miss 100 — the total doesn't", () => {
    const weights = [12.34, 0.01, 33.33, 33.33, 20.99]
    expect(weights.reduce((a, b) => a + b, 0)).not.toBe(100)
    expect(assessmentTotal(w(...weights))).toBe(100)
    expect(isComplete(weights.reduce((a, b) => a + b, 0))).toBe(true)
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(assessmentTotal(w(0.1, 0.2))).toBe(0.3)
  })

  it.each([
    [0, true],
    [2.5, true],
    [100, true],
    [12.34, true],
    [-1, false],
    [100.01, false],
    [2.555, false],
    [NaN, false],
    ["30", false],
  ])("weight %j is valid: %s", (value, valid) => {
    expect(isWeight(value)).toBe(valid)
  })
})
