import { describe, it, expect } from "vitest"
import { canMovePlanEntry } from "./plan"
import { canMoveRow, editRows, moveRow, rowErrorKey, rowErrors, withoutRowErrors } from "./rows"

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

describe("editRows — one edit to a row list (#105)", () => {
  const rows = [
    { weekNo: 1, topic: "a" },
    { weekNo: 2, topic: "b1" },
    { weekNo: 2, topic: "b2" },
  ]
  const topics = (r: { topic: string }[] | undefined) => r?.map((x) => x.topic)

  it("updates one row's fields in place — the rows keep their positions", () => {
    const result = editRows(rows, { kind: "update", index: 1, patch: { topic: "B" } }, canMoveRow)
    expect(topics(result?.rows)).toEqual(["a", "B", "b2"])
    expect(result?.reordered).toBe(false)
    expect(rows[1].topic).toBe("b1")
  })

  it("adds a row at the end", () => {
    const result = editRows(rows, { kind: "add", row: { weekNo: 3, topic: "" } }, canMoveRow)
    expect(topics(result?.rows)).toEqual(["a", "b1", "b2", ""])
    expect(result?.reordered).toBe(false)
  })

  it("removes a row — later rows shift, so row-keyed errors no longer line up", () => {
    const result = editRows(rows, { kind: "remove", index: 0 }, canMoveRow)
    expect(topics(result?.rows)).toEqual(["b1", "b2"])
    expect(result?.reordered).toBe(true)
  })

  it("moves a row the list's rule allows", () => {
    const result = editRows(rows, { kind: "move", index: 2, step: -1 }, canMovePlanEntry)
    expect(topics(result?.rows)).toEqual(["a", "b2", "b1"])
    expect(result?.reordered).toBe(true)
  })

  it.each([
    ["the Teaching Plan rule: not out of its week", canMovePlanEntry, 1, -1],
    ["any rule: not past the top", canMoveRow, 0, -1],
    ["any rule: not past the bottom", canMoveRow, 2, 1],
  ] as const)("refuses a move %s", (_, rule, index, step) => {
    expect(editRows(rows, { kind: "move", index, step }, rule)).toBeNull()
  })

  it("an Assessment Component moves to any neighbour", () => {
    expect(topics(editRows(rows, { kind: "move", index: 1, step: -1 }, canMoveRow)?.rows)).toEqual(["b1", "a", "b2"])
  })
})
