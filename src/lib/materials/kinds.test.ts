import { describe, it, expect } from "vitest"
import { MATERIAL_KINDS, isMaterialKind, materialKindLabel } from "./kinds"

describe("Material Kinds", () => {
  it("are Slides, Handout, Lab Sheet — in that order", () => {
    expect(MATERIAL_KINDS).toEqual(["slides", "handout", "lab"])
    expect(MATERIAL_KINDS.map(materialKindLabel)).toEqual(["สไลด์", "เอกสารประกอบ", "ใบงานปฏิบัติการ"])
  })

  it.each([
    ["slides", true],
    ["handout", true],
    ["lab", true],
    ["Slides", false],
    ["lab-sheet", false],
    ["", false],
    [1, false],
    [null, false],
    [undefined, false],
  ])("isMaterialKind(%j) → %s", (value, expected) => {
    expect(isMaterialKind(value)).toBe(expected)
  })
})
