import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { NextRequest } from "next/server"
import { POST } from "./route"
import { setTestDb } from "@/lib/db"
import { createUser, assignRole, type Queryable } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { seedWeeks, listWeeks } from "@/lib/weeks/repository"
import { createProblem, setTestCases } from "@/lib/problems/repository"
import { createSessionToken } from "@/lib/auth"

// Mock Piston — external HTTP; tested separately
vi.mock("@/lib/piston", () => ({
  runTestCases: vi.fn(),
}))

import { runTestCases } from "@/lib/piston"
const mockRun = vi.mocked(runTestCases)

const schema = readFileSync(
  fileURLToPath(new URL("../../../../schema.sql", import.meta.url)),
  "utf8"
)

function freshDb(): Queryable {
  const mem = newDb()
  mem.public.none(schema)
  const { Pool } = mem.adapters.createPg()
  return new Pool() as unknown as Queryable
}

function gradeReq(body: unknown, token?: string): NextRequest {
  const r = new NextRequest("http://localhost/api/grade", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (token) r.cookies.set("session", token)
  return r
}

const sessionFor = (email: string) => createSessionToken({ email, name: "x" })

describe("POST /api/grade", () => {
  let db: Queryable
  let courseId: number
  let problemId: number

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    mockRun.mockReset()

    const user = await createUser(db, { email: "student@kmitl.ac.th", name: "Student" })
    await assignRole(db, user.id, "Student")
    const course = await createCourse(db, { code: "C01", nameTh: "ก", nameEn: "A" })
    courseId = course.id
    await assignInstructor(db, courseId, user.id)
    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)
    const problem = await createProblem(db, {
      courseId,
      weekId: weeks[0].id,
      title: "Hello",
    })
    problemId = problem.id
    await setTestCases(db, problemId, [
      { input: "", expectedOutput: "Hello", isHidden: false, score: 10, sortOrder: 0 },
      { input: "", expectedOutput: "World", isHidden: true, score: 20, sortOrder: 1 },
    ])
  })

  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    const res = await POST(gradeReq({ problemId, code: "print('x')", mode: "run" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 for missing code", async () => {
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId }, token))
    expect(res.status).toBe(400)
  })

  it("returns 404 for unknown problemId (no hardcode fallback)", async () => {
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId: 99999, code: "print('x')", mode: "run" }, token))
    expect(res.status).toBe(404)
  })

  it("mode:run runs only visible test cases and returns pointsEarned/pointsMax", async () => {
    mockRun.mockResolvedValue([
      { testCaseId: 1, score: 10, passed: true, actualOutput: "Hello", expectedOutput: "Hello", executionTime: 0 },
    ])
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId, code: "print('Hello')", mode: "run" }, token))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pointsEarned).toBe(10)
    expect(body.pointsMax).toBe(10)   // only visible (score=10), hidden excluded
    expect(body.results).toHaveLength(1)
    // Piston was called with only the 1 visible test case
    const calledCases = mockRun.mock.calls[0][1]
    expect(calledCases).toHaveLength(1)
    expect(calledCases[0].isHidden).toBe(false)
  })

  it("mode:submit runs all test cases including hidden", async () => {
    mockRun.mockResolvedValue([
      { testCaseId: 1, score: 10, passed: true, actualOutput: "Hello", expectedOutput: "Hello", executionTime: 0 },
      { testCaseId: 2, score: 20, passed: false, actualOutput: "x", expectedOutput: "World", executionTime: 0 },
    ])
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId, code: "print('Hello')", mode: "submit" }, token))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pointsEarned).toBe(10)
    expect(body.pointsMax).toBe(30)   // visible(10) + hidden(20)
    expect(body.results).toHaveLength(2)
    const calledCases = mockRun.mock.calls[0][1]
    expect(calledCases).toHaveLength(2)
  })
})
