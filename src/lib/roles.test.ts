import { describe, it, expect } from "vitest"
import { getLandingRoute, getSidebarMenu, getAssignableRoles, resolveActiveRole } from "./roles"

describe("getLandingRoute", () => {
  it("lands Admin on User Management", () => {
    expect(getLandingRoute("Admin")).toBe("/users")
  })

  it("lands Instructor and TA on the student roster", () => {
    expect(getLandingRoute("Instructor")).toBe("/students")
    expect(getLandingRoute("TA")).toBe("/students")
  })

  it("lands Student on assigned work", () => {
    expect(getLandingRoute("Student")).toBe("/assignments")
  })
})

describe("getSidebarMenu", () => {
  const hrefs = (role: Parameters<typeof getSidebarMenu>[0]) =>
    getSidebarMenu(role).map((item) => item.href)

  it("gives Admin the superset: User Management + activity log + the teaching menu", () => {
    expect(hrefs("Admin")).toEqual([
      "/users",
      "/logs",
      "/courses",
      "/students",
      "/problems",
      "/review",
      "/gradebook",
    ])
  })

  it("gives Instructor course management plus the teaching menu (no User Management)", () => {
    expect(hrefs("Instructor")).toEqual([
      "/courses",
      "/students",
      "/problems",
      "/review",
      "/gradebook",
    ])
  })

  it("gives TA the teaching menu without course management", () => {
    expect(hrefs("TA")).toEqual(["/students", "/problems", "/review", "/gradebook"])
  })

  it("gives Student only the student menu", () => {
    expect(hrefs("Student")).toEqual(["/assignments", "/gradebook"])
  })

  it("labels each item in Thai", () => {
    const userMgmt = getSidebarMenu("Admin")[0]
    expect(userMgmt.label).toBe("จัดการผู้ใช้")
    expect(userMgmt.href).toBe("/users")
  })
})

describe("getAssignableRoles", () => {
  it("lets Admin assign every role", () => {
    expect([...getAssignableRoles("Admin")].sort()).toEqual([
      "Admin",
      "Instructor",
      "Student",
      "TA",
    ])
  })

  it("gives non-admins no role-assignment rights", () => {
    expect(getAssignableRoles("Instructor")).toEqual([])
    expect(getAssignableRoles("TA")).toEqual([])
    expect(getAssignableRoles("Student")).toEqual([])
  })
})

describe("resolveActiveRole", () => {
  it("defaults to the highest-privilege role the user holds", () => {
    expect(resolveActiveRole(["Student", "Admin", "TA"])).toBe("Admin")
    expect(resolveActiveRole(["Student", "TA"])).toBe("TA")
    expect(resolveActiveRole(["Student"])).toBe("Student")
  })

  it("honors a requested role the user actually holds", () => {
    expect(resolveActiveRole(["Admin", "Instructor"], "Instructor")).toBe("Instructor")
  })

  it("ignores a requested role the user does not hold", () => {
    expect(resolveActiveRole(["Instructor", "TA"], "Admin")).toBe("Instructor")
  })

  it("returns null when the user holds no roles", () => {
    expect(resolveActiveRole([])).toBeNull()
  })
})
