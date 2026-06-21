import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, POST } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { setWeekReleased, listWeeks } from "@/lib/weeks/repository"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"

describe("GET /api/courses/[code]/[year]/[semester]/weeks", () => {
  let f: CourseFixture
  let studentSession: string

  function req(session?: string): NextRequest {
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/weeks`
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

  it("Student sees only released weeks — hidden weeks absent from response", async () => {
    const weeks = await listWeeks(f.db, f.course)
    await setWeekReleased(f.db, weeks[0].id, true)

    const res = await GET(req(studentSession), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.weeks).toHaveLength(1)
    expect(body.weeks[0].weekNo).toBe(1)
    expect(body.weeks[0].isReleased).toBe(true)
  })

  it("Instructor sees all weeks including hidden ones", async () => {
    const weeks = await listWeeks(f.db, f.course)
    await setWeekReleased(f.db, weeks[0].id, true)

    const res = await GET(req(sessionFor(f.ins.email)), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.weeks).toHaveLength(weeks.length)
  })
})
