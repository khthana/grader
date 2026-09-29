import { describe, it, expect } from "vitest"
import { toProblemType } from "./problem-type"

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
