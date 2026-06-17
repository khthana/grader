import { describe, it, expect } from "vitest"
import { isCourseScopedPath } from "./scope"

describe("isCourseScopedPath", () => {
  it("is false for the global admin pages that aren't tied to a course", () => {
    expect(isCourseScopedPath("/users")).toBe(false)
    expect(isCourseScopedPath("/logs")).toBe(false)
    expect(isCourseScopedPath("/courses")).toBe(false)
  })

  it("is false for sub-paths of those pages too", () => {
    expect(isCourseScopedPath("/users/123")).toBe(false)
  })

  it("is true for the course-scoped pages", () => {
    expect(isCourseScopedPath("/students")).toBe(true)
    expect(isCourseScopedPath("/problems")).toBe(true)
    expect(isCourseScopedPath("/problems/42")).toBe(true)
    expect(isCourseScopedPath("/review")).toBe(true)
    expect(isCourseScopedPath("/gradebook")).toBe(true)
    expect(isCourseScopedPath("/assignments")).toBe(true)
  })

  it("does not confuse a longer name that merely starts with a global path", () => {
    expect(isCourseScopedPath("/coursesomething")).toBe(true)
  })
})
