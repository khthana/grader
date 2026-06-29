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

  it("unit problem with empty unitTestCode → error", () => {
    const result = validateProblemInput({ ...validInput, problemType: "unit", unitTestCode: "" })
    expect(result.valid).toBe(false)
    expect(result.errors.unitTestCode).toBeTruthy()
  })

  it("unit problem with unitTestCode → valid (no test cases required)", () => {
    const result = validateProblemInput({
      title: "Add", weekId: 1, dueAt: null, closeAt: null,
      problemType: "unit", unitTestCode: "assert add(1, 2) == 3", testCases: [],
    })
    expect(result.valid).toBe(true)
  })

  it("unit problem with empty functionName → valid (function name now optional)", () => {
    const result = validateProblemInput({
      ...validInput, problemType: "unit", functionName: "", unitTestCode: "assert add(1,2)==3",
    })
    expect(result.valid).toBe(true)
  })

  it("problemType omitted → valid (backward compat)", () => {
    const result = validateProblemInput(validInput)
    expect(result.valid).toBe(true)
  })

  it("blacklist with empty-string term → error", () => {
    const result = validateProblemInput({ ...validInput, blacklist: ["sort", ""] })
    expect(result.valid).toBe(false)
    expect(result.errors.blacklist).toBeTruthy()
  })

  it("whitelist undefined → valid", () => {
    const result = validateProblemInput({ ...validInput, whitelist: undefined })
    expect(result.valid).toBe(true)
  })

  it("unit mode in a non-Python course → error (unit harness is Python-only)", () => {
    const result = validateProblemInput({
      ...validInput,
      problemType: "unit",
      unitTestCode: "assert add(1,2)==3",
      language: "c",
    })
    expect(result.valid).toBe(false)
    expect(result.errors.problemType).toBeTruthy()
  })

  it("io mode in a non-Python course → valid", () => {
    const result = validateProblemInput({ ...validInput, problemType: "io", language: "c" })
    expect(result.valid).toBe(true)
  })

  it("unit mode with no language given → valid (defaults to Python)", () => {
    const result = validateProblemInput({
      ...validInput,
      problemType: "unit",
      unitTestCode: "assert add(1,2)==3",
    })
    expect(result.valid).toBe(true)
  })
})
