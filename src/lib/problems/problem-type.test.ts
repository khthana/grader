import { describe, it, expect } from "vitest"
import { toProblemType, isProblemType, isProblemTypeAllowed, canGenerateTests } from "./problem-type"

describe("toProblemType", () => {
  it("keeps unit", () => {
    expect(toProblemType("unit")).toBe("unit")
  })

  it("maps io, blank, unknown or missing values to io (the default mode)", () => {
    expect(toProblemType("io")).toBe("io")
    expect(toProblemType("")).toBe("io")
    expect(toProblemType("pytest")).toBe("io")
    expect(toProblemType(undefined)).toBe("io")
  })
})

describe("isProblemType", () => {
  it("accepts exactly io and unit", () => {
    expect(isProblemType("io")).toBe(true)
    expect(isProblemType("unit")).toBe(true)
    for (const v of ["", "pytest", 5, null, undefined]) expect(isProblemType(v)).toBe(false)
  })
})

// #86 — the one capability matrix: which Problem Types a course language may
// author, and where AI test generation is offered. Unknown languages get the
// strict answer (io only, no AI).
describe("Problem Type capabilities (type × language)", () => {
  it.each([
    ["io", "python", true, true],
    ["unit", "python", true, true],
    ["io", "c", true, false],
    ["unit", "c", false, false],
    ["io", "cobol", true, false],
    ["unit", "cobol", false, false],
  ] as const)("%s in %s → allowed %s, AI %s", (type, language, allowed, ai) => {
    expect(isProblemTypeAllowed(type, language)).toBe(allowed)
    expect(canGenerateTests(type, language)).toBe(ai)
  })
})
