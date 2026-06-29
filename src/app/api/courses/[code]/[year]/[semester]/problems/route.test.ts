import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"
import { updateCourse } from "@/lib/courses/repository"
import { getProblemById } from "@/lib/problems/repository"
import { listWeeks } from "@/lib/weeks/repository"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"

describe("POST /api/courses/[code]/[year]/[semester]/problems — language inheritance", () => {
  let f: CourseFixture
  let weekId: number

  function req(body: unknown, session?: string): NextRequest {
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/problems`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
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

  const problemBody = (over: Record<string, unknown> = {}) => ({
    title: "Sum",
    weekId,
    score: 10,
    testCases: [{ input: "1 2", expectedOutput: "3", isHidden: false, sortOrder: 0 }],
    ...over,
  })

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    weekId = (await listWeeks(f.db, f.course))[0].id
  })

  afterEach(() => setTestDb(null))

  it("creates a problem with the course language, ignoring the request body", async () => {
    await updateCourse(f.db, f.course, { nameTh: "ก", nameEn: "A", program: null, language: "c" })

    const res = await POST(req(problemBody({ language: "python" })), ctx())
    expect(res.status).toBe(201)
    const { problem } = await res.json()
    expect(problem.language).toBe("c")
    expect((await getProblemById(f.db, problem.id))?.language).toBe("c")
  })

  it("defaults to the course's python when the course is python", async () => {
    const res = await POST(req(problemBody()), ctx())
    expect(res.status).toBe(201)
    expect((await res.json()).problem.language).toBe("python")
  })
})
