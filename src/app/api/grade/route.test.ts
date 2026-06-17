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
import { createEnrollment } from "@/lib/enrollments/repository"
import { listSubmissions } from "@/lib/submissions/repository"
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

const PAST = new Date(Date.now() - 2 * 86400_000).toISOString()   // 2 days ago
const RECENT = new Date(Date.now() - 86400_000).toISOString()      // 1 day ago (due_at passed)
const FUTURE = new Date(Date.now() + 86400_000).toISOString()      // tomorrow

describe("POST /api/grade", () => {
  let db: Queryable
  let courseId: number
  let problemId: number
  let studentId: number

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    mockRun.mockReset()

    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, ins.id, "Instructor")
    const student = await createUser(db, { email: "student@kmitl.ac.th", name: "Student", idCode: "64010001" })
    await assignRole(db, student.id, "Student")
    studentId = student.id

    const course = await createCourse(db, { code: "C01", nameTh: "ก", nameEn: "A" })
    courseId = course.id
    await assignInstructor(db, courseId, ins.id)
    // Enroll student in the course
    await createEnrollment(db, { courseId, userId: student.id })

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
    expect(body.pointsMax).toBe(10)
    expect(body.results).toHaveLength(1)
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
    expect(body.pointsMax).toBe(30)
    expect(body.results).toHaveLength(2)
    const calledCases = mockRun.mock.calls[0][1]
    expect(calledCases).toHaveLength(2)
  })

  // ── Deadline enforcement ─────────────────────────────────────────────────

  it("mode:submit past close_at → 403, no submission stored", async () => {
    const weeks = await listWeeks(db, courseId)
    const p = await createProblem(db, {
      courseId, weekId: weeks[0].id, title: "Closed",
      dueAt: PAST, closeAt: RECENT,  // both in the past → closed
    })
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId: p.id, code: "print('x')", mode: "submit" }, token))
    expect(res.status).toBe(403)
    const subs = await listSubmissions(db, p.id)
    expect(subs).toHaveLength(0)
  })

  it("mode:submit past due_at but before close_at → 200, is_late = true", async () => {
    const weeks = await listWeeks(db, courseId)
    const p = await createProblem(db, {
      courseId, weekId: weeks[0].id, title: "Late",
      dueAt: RECENT, closeAt: FUTURE,   // due passed, close not yet
    })
    await setTestCases(db, p.id, [
      { input: "", expectedOutput: "x", isHidden: false, score: 5, sortOrder: 0 },
    ])
    mockRun.mockResolvedValue([
      { testCaseId: 1, score: 5, passed: true, actualOutput: "x", expectedOutput: "x", executionTime: 0 },
    ])
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId: p.id, code: "print('x')", mode: "submit" }, token))
    expect(res.status).toBe(200)
    const subs = await listSubmissions(db, p.id)
    expect(subs).toHaveLength(1)
    expect(subs[0].isLate).toBe(true)
  })

  it("mode:submit before due_at → 200, is_late = false, submission stored", async () => {
    mockRun.mockResolvedValue([
      { testCaseId: 1, score: 10, passed: true, actualOutput: "Hello", expectedOutput: "Hello", executionTime: 0 },
      { testCaseId: 2, score: 20, passed: true, actualOutput: "World", expectedOutput: "World", executionTime: 0 },
    ])
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId, code: "print('Hello')", mode: "submit" }, token))
    expect(res.status).toBe(200)
    const subs = await listSubmissions(db, problemId)
    expect(subs).toHaveLength(1)
    expect(subs[0].isLate).toBe(false)
    expect(subs[0].userId).toBe(studentId)
  })

  it("mode:submit student not enrolled → 403", async () => {
    const other = await createUser(db, { email: "other@kmitl.ac.th", name: "Other", idCode: "99" })
    await assignRole(db, other.id, "Student")
    // NOT enrolled in the course
    const token = sessionFor("other@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId, code: "print('x')", mode: "submit" }, token))
    expect(res.status).toBe(403)
  })

  it("no deadlines (both NULL) → 200, is_late = false", async () => {
    // problemId has no dueAt/closeAt (created in beforeEach)
    mockRun.mockResolvedValue([
      { testCaseId: 1, score: 10, passed: true, actualOutput: "Hello", expectedOutput: "Hello", executionTime: 0 },
      { testCaseId: 2, score: 20, passed: true, actualOutput: "World", expectedOutput: "World", executionTime: 0 },
    ])
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId, code: "print('Hello')", mode: "submit" }, token))
    expect(res.status).toBe(200)
    const subs = await listSubmissions(db, problemId)
    expect(subs[0].isLate).toBe(false)
  })

  it("mode:run → 200, no submission stored", async () => {
    mockRun.mockResolvedValue([
      { testCaseId: 1, score: 10, passed: true, actualOutput: "Hello", expectedOutput: "Hello", executionTime: 0 },
    ])
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId, code: "print('Hello')", mode: "run" }, token))
    expect(res.status).toBe(200)
    const subs = await listSubmissions(db, problemId)
    expect(subs).toHaveLength(0)
  })
})
