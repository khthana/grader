import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, POST } from "./route"
import { updateCourse } from "@/lib/courses/repository"
import { createProblem, getProblemById } from "@/lib/problems/repository"
import { listWeeks, setWeekReleased } from "@/lib/weeks/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { createUser, assignRole } from "@/lib/users/repository"
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

  it("rejects unit mode in a non-Python course (400)", async () => {
    await updateCourse(f.db, f.course, { nameTh: "ก", nameEn: "A", program: null, language: "c" })
    const res = await POST(
      req(problemBody({ problemType: "unit", unitTestCode: "assert add(1,2)==3", testCases: [] })),
      ctx()
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.errors.problemType).toBeTruthy()
  })

  it("allows unit mode in a Python course", async () => {
    const res = await POST(
      req(problemBody({ problemType: "unit", unitTestCode: "assert add(1,2)==3", testCases: [] })),
      ctx()
    )
    expect(res.status).toBe(201)
  })
})

describe("POST /api/courses/[code]/[year]/[semester]/problems — max score (#66)", () => {
  let f: CourseFixture
  let weekId: number

  function req(body: unknown): NextRequest {
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/problems`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    )
    r.cookies.set("session", sessionFor(f.ins.email))
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
    weekId = (await listWeeks(f.db, f.course))[0].id
  })

  afterEach(() => setTestDb(null))

  it("io mode: stores per-case scores and sets problem.score to their sum (client score ignored)", async () => {
    const res = await POST(
      req({
        title: "Sum",
        weekId,
        score: 10,
        testCases: [
          { input: "1", expectedOutput: "1", isHidden: false, score: 5, sortOrder: 0 },
          { input: "2", expectedOutput: "2", isHidden: true, score: 25, sortOrder: 1 },
        ],
      }),
      ctx()
    )
    expect(res.status).toBe(201)
    const stored = await getProblemById(f.db, (await res.json()).problem.id)
    expect(stored?.score).toBe(30)
    expect(stored?.testCases.map((tc) => tc.score)).toEqual([5, 25])
  })

  it("unit mode: keeps the problem's own score", async () => {
    const res = await POST(
      req({ title: "U", weekId, score: 40, problemType: "unit", unitTestCode: "assert f()", testCases: [] }),
      ctx()
    )
    expect(res.status).toBe(201)
    expect((await getProblemById(f.db, (await res.json()).problem.id))?.score).toBe(40)
  })

  it("rejects a negative or non-integer test-case score (400)", async () => {
    const res = await POST(
      req({
        title: "Sum",
        weekId,
        testCases: [{ input: "1", expectedOutput: "1", isHidden: false, score: -1, sortOrder: 0 }],
      }),
      ctx()
    )
    expect(res.status).toBe(400)
    expect((await res.json()).errors.testCases).toBeTruthy()
  })
})

describe("GET /api/courses/[code]/[year]/[semester]/problems — class counts (#77)", () => {
  let f: CourseFixture
  const STUDENT = "stu@kmitl.ac.th"
  const COUNTS = ["enrolledCount", "submittedCount", "pendingCount"]

  function get(email: string) {
    const r = new NextRequest(`http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/problems`)
    r.cookies.set("session", sessionFor(email))
    return GET(r, {
      params: Promise.resolve({ code: f.course.code, year: String(f.course.year), semester: String(f.course.semester) }),
    })
  }
  const firstProblem = async (email: string) => ((await (await get(email)).json()).problems as Record<string, unknown>[])[0]

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    const stu = await createUser(f.db, { email: STUDENT, name: "S" })
    await assignRole(f.db, stu.id, "Student")
    await createEnrollment(f.db, { courseCode: f.course.code, courseYear: f.course.year, courseSemester: f.course.semester, userId: stu.id })
    const week = (await listWeeks(f.db, f.course))[0]
    await setWeekReleased(f.db, week.id, true)
    await createProblem(f.db, { courseCode: f.course.code, courseYear: f.course.year, courseSemester: f.course.semester, weekId: week.id, title: "P" })
  })

  afterEach(() => setTestDb(null))

  it("an enrolled Student gets the plain list — no class-wide aggregates", async () => {
    const p = await firstProblem(STUDENT)
    expect(p.title).toBe("P")
    for (const k of COUNTS) expect(p).not.toHaveProperty(k)
  })

  it("Instructor and TA keep the counts (ส่งแล้ว X/Y, รอตรวจ N)", async () => {
    for (const email of [f.ins.email, f.ta.email]) {
      const p = await firstProblem(email)
      expect(p.enrolledCount).toBe(1)
      expect(p.submittedCount).toBe(0)
      expect(p.pendingCount).toBe(0)
    }
  })
})
