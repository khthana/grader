import { describe, it, expect } from "vitest"
import { moveRow, rowErrorKey, rowErrors, withoutRowErrors } from "./rows"

describe("Syllabus row lists", () => {
  const errors = {
    credits: "x",
    "plan.1.topic": "topic",
    "plan.1": "row",
    "plan.10.topic": "other row",
    "assessments.1.weight": "weight",
  }

  it("keys a row or one of its fields by its position as sent", () => {
    expect(rowErrorKey("plan", 2)).toBe("plan.2")
    expect(rowErrorKey("assessments", 0, "weight")).toBe("assessments.0.weight")
  })

  it("a row's errors are its own (row first), not row 10's or another list's", () => {
    expect(rowErrors(errors, "plan", 1)).toEqual(["row", "topic"])
    expect(rowErrors(errors, "assessments", 1)).toEqual(["weight"])
    expect(rowErrors(errors, "plan", 0)).toEqual([])
  })

  it("drops one list's row errors and keeps the rest", () => {
    expect(withoutRowErrors(errors, "plan")).toEqual({ credits: "x", "assessments.1.weight": "weight" })
  })

  it("moves a row one step, never past either end", () => {
    const rows = ["a", "b", "c"]
    expect(moveRow(rows, 0, 1)).toEqual(["b", "a", "c"])
    expect(moveRow(rows, 2, -1)).toEqual(["a", "c", "b"])
    expect(moveRow(rows, 0, -1)).toBe(rows)
    expect(moveRow(rows, 2, 1)).toBe(rows)
  })
})
