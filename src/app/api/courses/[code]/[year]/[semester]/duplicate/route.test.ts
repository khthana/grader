import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { listWeeks } from "@/lib/weeks/repository"
import { listCourseInstructors, createCourse } from "@/lib/courses/repository"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"

describe("POST /api/courses/[code]/[year]/[semester]/duplicate", () => {
  let f: CourseFixture
  let studentSession: string

  function req(body: unknown, session?: string): NextRequest {
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/duplicate`,
      { method: "POST", body: JSON.stringify(body) }
    )
    if (session) r.cookies.set("session", session)
    return r
  }

  function ctx() {
    return {
      params: Promise.resolve({
        code: f.course.code,
        year: String(f.course.year),
        semester: String(f.course.semester),
      }),
    }
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    const student = await createUser(f.db, { email: "stu@kmitl.ac.th", name: "Stu" })
    await assignRole(f.db, student.id, "Student")
    await createEnrollment(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      userId: student.id,
    })
    studentSession = sessionFor("stu@kmitl.ac.th")
  })

  afterEach(() => setTestDb(null))

  it("Instructor duplicates the offering — 201 with copied weeks and instructors", async () => {
    const res = await POST(req({ year: f.course.year, semester: 2 }, sessionFor(f.ins.email)), ctx())
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.course.semester).toBe(2)

    const target = { code: f.course.code, year: f.course.year, semester: 2 }
    expect(await listWeeks(f.db, target)).toHaveLength(6)
    const staff = await listCourseInstructors(f.db, target)
    expect(staff.map((s) => s.id)).toContain(f.ins.id)
  })

  it("forbids a TA (not a course manager) — 403", async () => {
    const res = await POST(req({ year: f.course.year, semester: 2 }, sessionFor(f.ta.email)), ctx())
    expect(res.status).toBe(403)
  })

  it("forbids an enrolled Student — 403", async () => {
    const res = await POST(req({ year: f.course.year, semester: 2 }, studentSession), ctx())
    expect(res.status).toBe(403)
  })

  it("rejects an unauthenticated request — 401", async () => {
    const res = await POST(req({ year: f.course.year, semester: 2 }), ctx())
    expect(res.status).toBe(401)
  })

  it("returns 409 when the target offering already exists", async () => {
    await createCourse(f.db, {
      code: f.course.code,
      year: f.course.year,
      semester: 2,
      nameTh: "ของเดิม",
      nameEn: "Existing",
    })
    const res = await POST(req({ year: f.course.year, semester: 2 }, sessionFor(f.ins.email)), ctx())
    expect(res.status).toBe(409)
  })

  it("returns 400 for an invalid target semester", async () => {
    const res = await POST(req({ year: f.course.year, semester: 5 }, sessionFor(f.ins.email)), ctx())
    expect(res.status).toBe(400)
  })

  it("returns 400 when the target equals the source", async () => {
    const res = await POST(
      req({ year: f.course.year, semester: f.course.semester }, sessionFor(f.ins.email)),
      ctx()
    )
    expect(res.status).toBe(400)
  })
})
