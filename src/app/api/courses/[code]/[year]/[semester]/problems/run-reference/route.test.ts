import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { updateCourse } from "@/lib/courses/repository"
import { setTestRunner, type CodeRunner } from "@/lib/grading"
import type { TestCase, TestResult } from "@/types"
import { POST } from "./route"

// A fake CodeRunner (#85) — the route runs through the same seam as grading,
// so no fetch/piston module mocking.
function fakeRunner(opts: { testCases?: TestResult[]; unit?: TestResult } = {}) {
  const calls = {
    testCases: [] as { code: string; cases: TestCase[]; language: string }[],
    unit: [] as { code: string; unitTestCode: string }[],
  }
  const runner: CodeRunner = {
    async runTestCases(code, cases, language) {
      calls.testCases.push({ code, cases, language })
      return opts.testCases ?? []
    },
    async runUnitTestBlock(code, unitTestCode) {
      calls.unit.push({ code, unitTestCode })
      return opts.unit ?? result({ testCaseId: 0, passed: true })
    },
  }
  return { runner, calls }
}

function result(over: Partial<TestResult>): TestResult {
  return { testCaseId: 1, passed: false, actualOutput: "", expectedOutput: "", executionTime: 0, ...over }
}

describe("POST /api/courses/[code]/[year]/[semester]/problems/run-reference", () => {
  let f: CourseFixture

  function req(body: unknown, session?: string): NextRequest {
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/problems/run-reference`,
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

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
  })

  afterEach(() => {
    setTestDb(null)
    setTestRunner(null)
  })

  it("instructor gets one output per input, in the course language", async () => {
    const { runner, calls } = fakeRunner({
      testCases: [
        result({ testCaseId: 1, actualOutput: "42" }),
        result({ testCaseId: 2, error: "err", errored: true }),
      ],
    })
    setTestRunner(runner)

    const res = await POST(req({ code: "print(42)", inputs: ["a", "b"] }), ctx())
    expect(res.status).toBe(200)
    expect((await res.json()).outputs).toEqual([
      { stdout: "42", stderr: "", ok: true },
      { stdout: "", stderr: "err", ok: false },
    ])
    expect(calls.testCases[0].language).toBe("python")
    expect(calls.testCases[0].cases.map((c) => c.input)).toEqual(["a", "b"])
  })

  it("a C course runs the reference solution as C", async () => {
    await updateCourse(f.db, f.course, { nameTh: "ก", nameEn: "A", program: null, language: "c" })
    const { runner, calls } = fakeRunner({ testCases: [result({ actualOutput: "7" })] })
    setTestRunner(runner)

    const res = await POST(req({ code: "int main(){...}", inputs: ["3 4"] }), ctx())
    expect(res.status).toBe(200)
    expect(calls.testCases[0].language).toBe("c")
  })

  it("unit mode: runs the block once and returns a single result", async () => {
    const { runner, calls } = fakeRunner({ unit: result({ testCaseId: 0, passed: false, error: "AssertionError" }) })
    setTestRunner(runner)

    const res = await POST(
      req({ code: "def add(a,b): return 0", problemType: "unit", unitTestCode: "assert add(1,2)==3" }),
      ctx()
    )
    expect(res.status).toBe(200)
    expect((await res.json()).outputs).toEqual([{ stdout: "", stderr: "AssertionError", ok: false }])
    expect(calls.unit).toEqual([{ code: "def add(a,b): return 0", unitTestCode: "assert add(1,2)==3" }])
    expect(calls.testCases).toHaveLength(0)
  })

  it("unit mode in a C course is 400 — the Python harness never runs (#85)", async () => {
    await updateCourse(f.db, f.course, { nameTh: "ก", nameEn: "A", program: null, language: "c" })
    const { runner, calls } = fakeRunner()
    setTestRunner(runner)

    const res = await POST(req({ code: "int main(){}", problemType: "unit", unitTestCode: "assert 1" }), ctx())
    expect(res.status).toBe(400)
    expect(calls.unit).toHaveLength(0)
  })

  it("empty inputs array returns 200 with empty outputs", async () => {
    setTestRunner(fakeRunner().runner)
    const res = await POST(req({ code: "print(1)", inputs: [] }), ctx())
    expect(res.status).toBe(200)
    expect((await res.json()).outputs).toEqual([])
  })

  it("student enrolled in course gets 403", async () => {
    const student = await createUser(f.db, { email: "stu@kmitl.ac.th", name: "Stu" })
    await assignRole(f.db, student.id, "Student")
    await createEnrollment(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      userId: student.id,
    })
    const res = await POST(req({ code: "print(1)", inputs: [""] }, sessionFor(student.email)), ctx())
    expect(res.status).toBe(403)
  })

  it.each([
    ["missing code", { inputs: [""] }],
    ["missing inputs", { code: "print(1)" }],
    ["inputs not an array", { code: "print(1)", inputs: "x" }],
    ["a non-string input", { code: "print(1)", inputs: [1] }],
    ["unit mode without unitTestCode", { code: "x", problemType: "unit" }],
  ])("%s returns 400", async (_label, body) => {
    const res = await POST(req(body), ctx())
    expect(res.status).toBe(400)
  })
})
