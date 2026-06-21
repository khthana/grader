import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"

// Mock Piston — external HTTP; tested separately in src/lib/piston.test.ts
vi.mock("@/lib/piston", () => ({
  runReferenceSolution: vi.fn(),
}))

import { runReferenceSolution } from "@/lib/piston"
const mockRun = vi.mocked(runReferenceSolution)

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
    expect(mockRun).toHaveBeenCalledWith("print(42)", ["", ""])
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
