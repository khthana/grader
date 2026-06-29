import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { PUT } from "./route"
import { getCourseByKey, updateCourse } from "@/lib/courses/repository"
import { createProblem } from "@/lib/problems/repository"
import { listWeeks } from "@/lib/weeks/repository"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"

describe("PUT /api/courses/[code]/[year]/[semester] — language lock", () => {
  let f: CourseFixture

  function req(body: unknown, session?: string): NextRequest {
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}`,
      { method: "PUT", body: JSON.stringify(body) }
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
      }),
    }
  }

  async function addProblem() {
    const weeks = await listWeeks(f.db, f.course)
    await createProblem(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      weekId: weeks[0].id,
      title: "P1",
    })
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
  })

  afterEach(() => setTestDb(null))

  it("changes the language while the course has no problems", async () => {
    const res = await PUT(req({ nameTh: "ก", nameEn: "A", language: "c" }), ctx())
    expect(res.status).toBe(200)
    expect((await getCourseByKey(f.db, f.course))?.language).toBe("c")
  })

  it("rejects a language change once the course has problems (language unchanged)", async () => {
    await addProblem()
    const res = await PUT(req({ nameTh: "ก", nameEn: "A", language: "c" }), ctx())
    expect(res.status).toBe(409)
    expect((await getCourseByKey(f.db, f.course))?.language).toBe("python")
  })

  it("still updates names when the course has problems and language is unchanged", async () => {
    await addProblem()
    const res = await PUT(req({ nameTh: "ใหม่", nameEn: "New", language: "python" }), ctx())
    expect(res.status).toBe(200)
    const course = await getCourseByKey(f.db, f.course)
    expect(course?.nameTh).toBe("ใหม่")
    expect(course?.language).toBe("python")
  })

  it("rejects an unsupported language with 400", async () => {
    const res = await PUT(req({ nameTh: "ก", nameEn: "A", language: "rust" }), ctx())
    expect(res.status).toBe(400)
  })

  it("updates names when no language field is sent (back-compat)", async () => {
    await updateCourse(f.db, f.course, { nameTh: "x", nameEn: "x", program: null, language: "c" })
    await addProblem()
    const res = await PUT(req({ nameTh: "ชื่อใหม่", nameEn: "NewName" }), ctx())
    expect(res.status).toBe(200)
    const course = await getCourseByKey(f.db, f.course)
    expect(course?.nameTh).toBe("ชื่อใหม่")
    expect(course?.language).toBe("c")
  })
})
