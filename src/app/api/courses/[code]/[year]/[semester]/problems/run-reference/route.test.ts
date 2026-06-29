import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"

// Mock Piston — external HTTP; tested separately in src/lib/piston.test.ts
vi.mock("@/lib/piston", () => ({
  runReferenceSolution: vi.fn(),
  runUnitTestBlock: vi.fn(),
}))

import { runReferenceSolution, runUnitTestBlock } from "@/lib/piston"
const mockRun = vi.mocked(runReferenceSolution)
const mockBlock = vi.mocked(runUnitTestBlock)

import { POST } from "./route"

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
    mockRun.mockReset()
    mockBlock.mockReset()
  })

  afterEach(() => setTestDb(null))

  it("instructor gets 200 with outputs from piston", async () => {
    mockRun.mockResolvedValue([
      { stdout: "42", stderr: "", ok: true },
      { stdout: "", stderr: "err", ok: false },
    ])
    const res = await POST(req({ code: "print(42)", inputs: ["", ""] }), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.outputs).toHaveLength(2)
    expect(body.outputs[0]).toEqual({ stdout: "42", stderr: "", ok: true })
    expect(body.outputs[1]).toEqual({ stdout: "", stderr: "err", ok: false })
    expect(mockRun).toHaveBeenCalledWith("print(42)", ["", ""], "python")
  })

  it("io mode threads the course language into runReferenceSolution", async () => {
    const { updateCourse } = await import("@/lib/courses/repository")
    await updateCourse(f.db, f.course, { nameTh: "ก", nameEn: "A", program: null, language: "c" })
    mockRun.mockResolvedValue([{ stdout: "7", stderr: "", ok: true }])

    const res = await POST(req({ code: "int main(){...}", inputs: ["3 4"] }), ctx())
    expect(res.status).toBe(200)
    expect(mockRun).toHaveBeenCalledWith("int main(){...}", ["3 4"], "c")
  })

  it("unit mode: runs reference solution + unit test block, returns single ok result", async () => {
    mockBlock.mockResolvedValue({
      testCaseId: 0, passed: true, actualOutput: "", expectedOutput: "", executionTime: 0,
    })
    const res = await POST(
      req({ code: "def add(a,b): return a+b", problemType: "unit", unitTestCode: "assert add(1,2)==3" }),
      ctx()
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.outputs).toHaveLength(1)
    expect(body.outputs[0].ok).toBe(true)
    expect(mockBlock).toHaveBeenCalledWith("def add(a,b): return a+b", "assert add(1,2)==3")
    expect(mockRun).not.toHaveBeenCalled()
  })

  it("unit mode: failing block returns ok:false with traceback in stderr", async () => {
    mockBlock.mockResolvedValue({
      testCaseId: 0, passed: false, actualOutput: "", expectedOutput: "", executionTime: 0, error: "AssertionError",
    })
    const res = await POST(
      req({ code: "def add(a,b): return 0", problemType: "unit", unitTestCode: "assert add(1,2)==3" }),
      ctx()
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.outputs[0].ok).toBe(false)
    expect(body.outputs[0].stderr).toContain("AssertionError")
  })

  it("empty inputs array returns 200 with empty outputs", async () => {
    mockRun.mockResolvedValue([])
    const res = await POST(req({ code: "print(1)", inputs: [] }), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.outputs).toEqual([])
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

  it("missing code returns 400", async () => {
    const res = await POST(req({ inputs: [""] }), ctx())
    expect(res.status).toBe(400)
  })

  it("missing inputs returns 400", async () => {
    const res = await POST(req({ code: "print(1)" }), ctx())
    expect(res.status).toBe(400)
  })

  it("inputs not an array returns 400", async () => {
    const res = await POST(req({ code: "print(1)", inputs: "x" }), ctx())
    expect(res.status).toBe(400)
  })
})
