import { describe, it, expect } from "vitest"
import { canMovePlanEntry, nextPlanWeek, sortPlan } from "./plan"
import { editRows } from "./rows"

const e = (weekNo: number, topic = "") => ({ weekNo, topic, detail: "" })

describe("Teaching Plan rules (#100)", () => {
  it("sorts by week, keeping the order of entries in one week", () => {
    const sorted = sortPlan([e(3, "c"), e(1, "a1"), e(2, "b"), e(1, "a2")])
    expect(sorted.map((x) => x.topic)).toEqual(["a1", "a2", "b", "c"])
  })

  it.each([
    [[], 1],
    [[e(1), e(4), e(2)], 5],
    [[e(20)], 20],
  ])("a new row suggests the highest week + 1 — %j → %i", (entries, expected) => {
    expect(nextPlanWeek(entries)).toBe(expected)
  })

  it("moves a row only past a row of the same week", () => {
    const plan = [e(1, "a"), e(2, "b1"), e(2, "b2"), e(3, "c")]
    expect(canMovePlanEntry(plan, 1, -1)).toBe(false)
    expect(canMovePlanEntry(plan, 1, 1)).toBe(true)
    expect(canMovePlanEntry(plan, 3, 1)).toBe(false)
    const move = (index: number, step: -1 | 1) => editRows(plan, { kind: "move", index, step }, canMovePlanEntry)
    expect(move(2, -1)?.rows.map((x) => x.topic)).toEqual(["a", "b2", "b1", "c"])
    expect(move(0, 1)).toBeNull()
  })
})
