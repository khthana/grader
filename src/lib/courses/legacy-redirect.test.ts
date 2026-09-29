import { describe, it, expect } from "vitest"
import { resolveLegacyRedirect } from "./legacy-redirect"

const course = { code: "C01", year: 2567, semester: 1 }
const student = { staff: false, manager: false }
const ta = { staff: true, manager: false }
const instructor = { staff: true, manager: true }

describe("resolveLegacyRedirect (#81)", () => {
  it("asks to pick a course when there is no active course", () => {
    expect(resolveLegacyRedirect(null, null, { section: "gradebook", requires: "staff" })).toEqual({
      kind: "pick-course",
    })
  })

  it("redirects staff of the active course to its section", () => {
    expect(resolveLegacyRedirect(course, ta, { section: "gradebook", requires: "staff" })).toEqual({
      kind: "redirect",
      path: "/courses/C01/2567/1/gradebook",
    })
    expect(resolveLegacyRedirect(course, instructor, { section: "review", requires: "manager" })).toEqual({
      kind: "redirect",
      path: "/courses/C01/2567/1/review",
    })
  })

  it("404s a user who is only a student in the active course — whatever their global role", () => {
    expect(resolveLegacyRedirect(course, student, { section: "gradebook", requires: "staff" }).kind).toBe("not-found")
  })

  it("404s a TA on review (manager only)", () => {
    expect(resolveLegacyRedirect(course, ta, { section: "review", requires: "manager" }).kind).toBe("not-found")
  })

  it("404s when the user has no access to the active course at all", () => {
    expect(resolveLegacyRedirect(course, null, { section: "gradebook", requires: "staff" }).kind).toBe("not-found")
  })
})
