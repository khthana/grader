import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { PUT } from "./route"
import { updateCourse } from "@/lib/courses/repository"
import { createProblem } from "@/lib/problems/repository"
import { listWeeks } from "@/lib/weeks/repository"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"

describe("PUT /api/courses/[code]/[year]/[semester]/problems/[pid] — unit mode guard", () => {
  let f: CourseFixture
  let problemId: number
  let weekId: number

  function req(body: unknown, session?: string): NextRequest {
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/problems/${problemId}`,
      { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    )
    r.cookies.set("session", session ?? sessionFor(f.ins.email))
    return r
  }

  function ctx() {
    return {
      params: Promise.resolve({
        code: f.course.code,
        year: String(f.course.year),
        semester: String(f.course.semester),
        pid: String(problemId),
      }),
    }
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    weekId = (await listWeeks(f.db, f.course))[0].id
    const p = await createProblem(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      weekId,
      title: "P1",
    })
    problemId = p.id
  })

  afterEach(() => setTestDb(null))

  it("rejects switching a problem to unit mode in a non-Python course (400)", async () => {
    await updateCourse(f.db, f.course, { nameTh: "ก", nameEn: "A", program: null, language: "c" })
    const res = await PUT(
      req({ title: "P1", weekId, problemType: "unit", unitTestCode: "assert x", testCases: [] }),
      ctx()
    )
    expect(res.status).toBe(400)
    expect((await res.json()).errors.problemType).toBeTruthy()
  })
})
