import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, PUT } from "./route"
import { updateCourse } from "@/lib/courses/repository"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { createProblem, getProblemById, setTestCases } from "@/lib/problems/repository"
import { listWeeks, setWeekReleased } from "@/lib/weeks/repository"
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
    await setWeekReleased(f.db, weekId, true)
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

  it("io mode: re-derives problem.score from the edited test-case scores (#66)", async () => {
    const res = await PUT(
      req({
        title: "P1",
        weekId,
        score: 10,
        testCases: [
          { input: "1", expectedOutput: "1", isHidden: false, score: 15, sortOrder: 0 },
          { input: "2", expectedOutput: "2", isHidden: false, score: 15, sortOrder: 1 },
          { input: "3", expectedOutput: "3", isHidden: true, score: 20, sortOrder: 2 },
        ],
      }),
      ctx()
    )
    expect(res.status).toBe(200)
    expect((await res.json()).problem.score).toBe(50)
    expect((await getProblemById(f.db, problemId))?.score).toBe(50)
  })

  it("omitting problemType on a unit problem validates and saves it as unit (#83)", async () => {
    // Was: validated as io (absent type → needs Test Cases → 400) while the
    // write kept the stored unit type.
    const unit = await createProblem(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      weekId,
      title: "U",
      score: 30,
      problemType: "unit",
      unitTestCode: "assert add(1, 2) == 3",
    })
    problemId = unit.id

    const res = await PUT(req({ title: "U edited" }), ctx())
    expect(res.status).toBe(200)
    const saved = await getProblemById(f.db, problemId)
    expect(saved).toMatchObject({
      title: "U edited",
      problemType: "unit",
      unitTestCode: "assert add(1, 2) == 3",
      score: 30,
      testCases: [],
    })
  })

  it("a unit problem never stores Test Cases, even when the body sends some (#83)", async () => {
    const unit = await createProblem(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      weekId,
      title: "U",
      problemType: "unit",
      unitTestCode: "assert f()",
    })
    problemId = unit.id

    const res = await PUT(
      req({ testCases: [{ input: "1", expectedOutput: "1", isHidden: false, sortOrder: 0 }] }),
      ctx()
    )
    expect(res.status).toBe(200)
    expect((await getProblemById(f.db, problemId))?.testCases).toEqual([])
  })

  it("an omitted deadline keeps its stored value (#83)", async () => {
    await setTestCases(f.db, problemId, [{ input: "1", expectedOutput: "1", isHidden: false, sortOrder: 0 }])
    await PUT(req({ dueAt: "2026-10-01T00:00:00.000Z", closeAt: "2026-10-02T00:00:00.000Z" }), ctx())

    const res = await PUT(req({ title: "Renamed" }), ctx())
    expect(res.status).toBe(200)
    const saved = await getProblemById(f.db, problemId)
    expect(saved?.title).toBe("Renamed")
    expect(saved?.dueAt).not.toBeNull()
    expect(saved?.closeAt).not.toBeNull()
    expect(saved?.testCases).toHaveLength(1)
  })

  it("404s an unknown problem before validating the body", async () => {
    problemId = 99999
    const res = await PUT(req({}), ctx())
    expect(res.status).toBe(404)
  })
})

describe("GET /api/courses/[code]/[year]/[semester]/problems/[pid] — student view (#71)", () => {
  let f: CourseFixture
  let problemId: number

  function get(email: string): Promise<Response> {
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/problems/${problemId}`
    )
    r.cookies.set("session", sessionFor(email))
    return GET(r, {
      params: Promise.resolve({
        code: f.course.code,
        year: String(f.course.year),
        semester: String(f.course.semester),
        pid: String(problemId),
      }),
    })
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    const student = await createUser(f.db, { email: "stu@kmitl.ac.th", name: "S" })
    await assignRole(f.db, student.id, "Student")
    await createEnrollment(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      userId: student.id,
    })
    const weekId = (await listWeeks(f.db, f.course))[0].id
    await setWeekReleased(f.db, weekId, true)
    problemId = (
      await createProblem(f.db, {
        courseCode: f.course.code,
        courseYear: f.course.year,
        courseSemester: f.course.semester,
        weekId,
        title: "P1",
        unitTestCode: "assert solve() == 'UNIT-SECRET'",
      })
    ).id
    await setTestCases(f.db, problemId, [
      { input: "1", expectedOutput: "one", isHidden: false, score: 10, sortOrder: 0 },
      { input: "HIDDEN-IN", expectedOutput: "HIDDEN-OUT", isHidden: true, score: 10, sortOrder: 1 },
    ])
  })

  afterEach(() => setTestDb(null))

  it("enrolled Student gets only visible test cases and no unit-test code", async () => {
    const res = await get("stu@kmitl.ac.th")
    expect(res.status).toBe(200)
    const { problem } = await res.json()
    expect(problem.testCases).toHaveLength(1)
    expect(problem.testCases[0].expectedOutput).toBe("one")
    expect(problem.unitTestCode).toBeUndefined()
    const text = JSON.stringify(problem)
    expect(text).not.toContain("HIDDEN")
    expect(text).not.toContain("UNIT-SECRET")
  })

  it("teaching staff get the full problem", async () => {
    for (const email of ["ins@kmitl.ac.th", "ta@kmitl.ac.th"]) {
      const { problem } = await (await get(email)).json()
      expect(problem.testCases).toHaveLength(2)
      expect(problem.unitTestCode).toContain("UNIT-SECRET")
    }
  })
})
