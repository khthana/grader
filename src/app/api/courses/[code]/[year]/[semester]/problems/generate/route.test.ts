import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { createProblem } from "@/lib/problems/repository"
import { createCourse } from "@/lib/courses/repository"
import { seedWeeks } from "@/lib/weeks/repository"

// Partial mock: preserve real LlmNotConfiguredError, only mock generateTestPlan
vi.mock("@/lib/llm", async () => {
  const actual = await vi.importActual<typeof import("@/lib/llm")>("@/lib/llm")
  return { ...actual, generateTestPlan: vi.fn() }
})

import { generateTestPlan, LlmNotConfiguredError } from "@/lib/llm"
const mockGenerate = vi.mocked(generateTestPlan)

import { POST } from "./route"

describe("POST /api/courses/[code]/[year]/[semester]/problems/generate", () => {
  let f: CourseFixture
  let problemId: number

  function req(body: unknown, session?: string): NextRequest {
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/problems/generate`,
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
    mockGenerate.mockReset()

    // Seed a problem belonging to this course
    const weeks = await f.db.query<{ id: number }>(
      "SELECT id FROM weeks WHERE course_code=$1 AND course_year=$2 AND course_semester=$3 LIMIT 1",
      [f.course.code, f.course.year, f.course.semester]
    )
    const weekId = weeks.rows[0].id
    const result = await createProblem(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      weekId,
      title: "Square",
      description: "Print n squared",
      inputSpec: "one integer n",
      outputSpec: "n squared",
      score: 10,
      testCases: [{ input: "3", expectedOutput: "9", isHidden: false, sortOrder: 0 }],
    })
    problemId = result.id
  })

  afterEach(() => setTestDb(null))

  it("instructor gets 200 with solution and inputs from LLM", async () => {
    mockGenerate.mockResolvedValue({ solution: "print(int(input())**2)", inputs: ["3", "5", "0"] })
    const res = await POST(req({ problemId }), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.solution).toBe("print(int(input())**2)")
    expect(body.inputs).toEqual(["3", "5", "0"])
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Square", description: "Print n squared" })
    )
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
    const res = await POST(req({ problemId }, sessionFor(student.email)), ctx())
    expect(res.status).toBe(403)
  })

  it("missing problemId and title returns 400", async () => {
    const res = await POST(req({}), ctx())
    expect(res.status).toBe(400)
  })

  it("raw fields path (create mode): returns 200 with generated result", async () => {
    mockGenerate.mockResolvedValue({ solution: "print('hi')", inputs: ["a", "b"] })
    const res = await POST(
      req({ title: "Hello", description: "Print hello", inputSpec: "", outputSpec: "" }),
      ctx()
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.solution).toBe("print('hi')")
    expect(body.inputs).toEqual(["a", "b"])
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Hello", description: "Print hello" })
    )
  })

  it("raw fields path: empty title returns 400", async () => {
    const res = await POST(req({ title: "  ", description: "desc" }), ctx())
    expect(res.status).toBe(400)
  })

  it("non-existent problemId returns 404", async () => {
    const res = await POST(req({ problemId: 99999 }), ctx())
    expect(res.status).toBe(404)
  })

  it("problemId belonging to a different course returns 404", async () => {
    // Create a second course in the same f.db so IDs are in the same sequence
    const c2 = await createCourse(f.db, {
      code: "C02",
      year: 2567,
      semester: 1,
      nameTh: "วิชาอื่น",
      nameEn: "Other",
    })
    await seedWeeks(f.db, { code: c2.code, year: c2.year, semester: c2.semester })
    const weeks2 = await f.db.query<{ id: number }>(
      "SELECT id FROM weeks WHERE course_code=$1 AND course_year=$2 AND course_semester=$3 LIMIT 1",
      [c2.code, c2.year, c2.semester]
    )
    const weekId2 = weeks2.rows[0].id
    const p2 = await createProblem(f.db, {
      courseCode: c2.code,
      courseYear: c2.year,
      courseSemester: c2.semester,
      weekId: weekId2,
      title: "Other",
      description: "Other problem",
      inputSpec: "",
      outputSpec: "",
      score: 5,
      testCases: [{ input: "", expectedOutput: "", isHidden: false, sortOrder: 0 }],
    })
    // Request against f's course (C01) using p2's id (belongs to C02) → 404
    const res = await POST(req({ problemId: p2.id }), ctx())
    expect(res.status).toBe(404)
  })

  it("returns 503 when LLM is not configured", async () => {
    mockGenerate.mockRejectedValue(new LlmNotConfiguredError())
    const res = await POST(req({ problemId }), ctx())
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/not configured/i)
  })
})
