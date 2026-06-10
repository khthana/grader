import { describe, it, expect } from "vitest"
import { deriveBreadcrumbs } from "./breadcrumbs"

describe("deriveBreadcrumbs", () => {
  it("returns just the home crumb for the dashboard", () => {
    expect(deriveBreadcrumbs("/dashboard")).toEqual([
      { label: "หน้าหลัก", href: "/dashboard" },
    ])
  })

  it("prefixes a known top-level page with home", () => {
    expect(deriveBreadcrumbs("/users")).toEqual([
      { label: "หน้าหลัก", href: "/dashboard" },
      { label: "จัดการผู้ใช้", href: "/users" },
    ])
  })

  it("accumulates hrefs for nested paths and keeps order", () => {
    expect(deriveBreadcrumbs("/problems/123")).toEqual([
      { label: "หน้าหลัก", href: "/dashboard" },
      { label: "โจทย์ปัญหา", href: "/problems" },
      { label: "123", href: "/problems/123" },
    ])
  })

  it("falls back to the decoded segment for unknown labels", () => {
    expect(deriveBreadcrumbs("/students/%E0%B8%81%E0%B8%81")).toEqual([
      { label: "หน้าหลัก", href: "/dashboard" },
      { label: "รายชื่อนักศึกษา", href: "/students" },
      { label: "กก", href: "/students/%E0%B8%81%E0%B8%81" },
    ])
  })

  it("ignores trailing slashes and empty segments", () => {
    expect(deriveBreadcrumbs("/users/")).toEqual([
      { label: "หน้าหลัก", href: "/dashboard" },
      { label: "จัดการผู้ใช้", href: "/users" },
    ])
  })

  it("returns home alone for the root path", () => {
    expect(deriveBreadcrumbs("/")).toEqual([
      { label: "หน้าหลัก", href: "/dashboard" },
    ])
  })
})
