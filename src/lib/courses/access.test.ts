import { describe, it, expect } from "vitest"
import { resolveActiveCourse, canMutateRoster } from "./access"

const courses = [
  { id: 1, code: "C1" },
  { id: 2, code: "C2" },
  { id: 3, code: "C3" },
]

describe("resolveActiveCourse", () => {
  it("returns the requested course when it is in the list", () => {
    expect(resolveActiveCourse(courses, 2)?.code).toBe("C2")
  })

  it("falls back to the first course when none is requested", () => {
    expect(resolveActiveCourse(courses)?.code).toBe("C1")
  })

  it("falls back to the first course when the requested id is not entitled", () => {
    expect(resolveActiveCourse(courses, 999)?.code).toBe("C1")
  })

  it("returns null for an empty list", () => {
    expect(resolveActiveCourse([], 1)).toBeNull()
  })
})

describe("canMutateRoster", () => {
  it("lets Admin and Instructor mutate the roster", () => {
    expect(canMutateRoster(["Admin"])).toBe(true)
    expect(canMutateRoster(["Instructor"])).toBe(true)
  })

  it("makes TA and Student read-only", () => {
    expect(canMutateRoster(["TA"])).toBe(false)
    expect(canMutateRoster(["Student"])).toBe(false)
    expect(canMutateRoster([])).toBe(false)
  })

  it("grants mutation when any role qualifies", () => {
    expect(canMutateRoster(["TA", "Instructor"])).toBe(true)
  })
})
