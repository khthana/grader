import { describe, it, expect } from "vitest"
import { resolveActiveCourse, canMutateRoster, canManageCourses, isTeachingStaff } from "./access"
import type { CourseRecord } from "./types"

const courses: CourseRecord[] = [
  { code: "C1", year: 2567, semester: 1, nameTh: "ก", nameEn: "A", program: null, createdAt: "" },
  { code: "C2", year: 2567, semester: 1, nameTh: "ข", nameEn: "B", program: null, createdAt: "" },
  { code: "C3", year: 2567, semester: 1, nameTh: "ค", nameEn: "C", program: null, createdAt: "" },
]

describe("resolveActiveCourse", () => {
  it("returns the requested course when it is in the list", () => {
    expect(resolveActiveCourse(courses, "C2/2567/1")?.code).toBe("C2")
  })

  it("falls back to the first course when none is requested", () => {
    expect(resolveActiveCourse(courses)?.code).toBe("C1")
  })

  it("falls back to the first course when the requested id is not entitled", () => {
    expect(resolveActiveCourse(courses, "ZZ/2567/1")?.code).toBe("C1")
  })

  it("returns null for an empty list", () => {
    expect(resolveActiveCourse([], "C1/2567/1")).toBeNull()
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

describe("canManageCourses", () => {
  it("lets Admin and Instructor manage courses", () => {
    expect(canManageCourses(["Admin"])).toBe(true)
    expect(canManageCourses(["Instructor"])).toBe(true)
  })

  it("blocks TA and Student from course management", () => {
    expect(canManageCourses(["TA"])).toBe(false)
    expect(canManageCourses(["Student"])).toBe(false)
    expect(canManageCourses([])).toBe(false)
  })
})

describe("isTeachingStaff", () => {
  it("treats Admin, Instructor, and TA as teaching staff", () => {
    expect(isTeachingStaff(["Admin"])).toBe(true)
    expect(isTeachingStaff(["Instructor"])).toBe(true)
    expect(isTeachingStaff(["TA"])).toBe(true)
  })

  it("does not treat a Student-only user as teaching staff", () => {
    expect(isTeachingStaff(["Student"])).toBe(false)
    expect(isTeachingStaff([])).toBe(false)
  })

  it("counts a user as staff when any role qualifies", () => {
    expect(isTeachingStaff(["Student", "TA"])).toBe(true)
  })
})
