import { describe, it, expect } from "vitest"
import { validateProblemInput } from "./validation"

const validInput = {
  title: "Hello World",
  weekId: 1,
  dueAt: null,
  closeAt: null,
  testCases: [{}],
}

describe("validateProblemInput", () => {
  it("valid input returns { valid: true }", () => {
    const result = validateProblemInput(validInput)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it("missing title → error", () => {
    const result = validateProblemInput({ ...validInput, title: "" })
    expect(result.valid).toBe(false)
    expect(result.errors.title).toBeTruthy()
  })

  it("missing weekId → error", () => {
    const result = validateProblemInput({ ...validInput, weekId: undefined })
    expect(result.valid).toBe(false)
    expect(result.errors.weekId).toBeTruthy()
  })

  it("zero test cases → error", () => {
    const result = validateProblemInput({ ...validInput, testCases: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.testCases).toBeTruthy()
  })

  it("score < 0 → error", () => {
    const result = validateProblemInput({ ...validInput, score: -1 })
    expect(result.valid).toBe(false)
    expect(result.errors.score).toBeTruthy()
  })

  it("score = 0 → valid", () => {
    const result = validateProblemInput({ ...validInput, score: 0 })
    expect(result.valid).toBe(true)
  })

  it("close_at < due_at → error", () => {
    const result = validateProblemInput({
      ...validInput,
      dueAt: "2026-06-20T00:00:00Z",
      closeAt: "2026-06-19T00:00:00Z",
    })
    expect(result.valid).toBe(false)
    expect(result.errors.closeAt).toBeTruthy()
  })

  it("close_at = due_at → valid", () => {
    const result = validateProblemInput({
      ...validInput,
      dueAt: "2026-06-20T00:00:00Z",
      closeAt: "2026-06-20T00:00:00Z",
    })
    expect(result.valid).toBe(true)
  })

  it("only due_at set (no close_at) → valid", () => {
    const result = validateProblemInput({
      ...validInput,
      dueAt: "2026-06-20T00:00:00Z",
      closeAt: null,
    })
    expect(result.valid).toBe(true)
  })
})
