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
    expect(deriveBreadcrumbs("/logs")).toEqual([
      { label: "หน้าหลัก", href: "/dashboard" },
      { label: "บันทึกกิจกรรม", href: "/logs" },
    ])
  })

  it("accumulates hrefs for nested paths and keeps order", () => {
    expect(deriveBreadcrumbs("/problems/123")).toEqual([
      { label: "หน้าหลัก", href: "/dashboard" },
      { label: "โจทย์ปัญหา", href: "/problems" },
      { label: "123", href: "/problems/123" },
    ])
  })

  it("labels the quizzes section แบบทดสอบ", () => {
    expect(deriveBreadcrumbs("/quizzes")).toEqual([
      { label: "หน้าหลัก", href: "/dashboard" },
      { label: "แบบทดสอบ", href: "/quizzes" },
    ])
  })

  it("labels a Teaching Material page by its Kind (#109)", () => {
    expect(deriveBreadcrumbs("/materials/3/lab")).toEqual([
      { label: "หน้าหลัก", href: "/dashboard" },
      { label: "เอกสารการสอน", href: "/materials" },
      { label: "3", href: "/materials/3" },
      { label: "ใบงานปฏิบัติการ", href: "/materials/3/lab" },
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
