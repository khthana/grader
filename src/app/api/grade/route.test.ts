import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { seedWeeks, listWeeks } from "@/lib/weeks/repository"
import { createProblem, setTestCases } from "@/lib/problems/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { listSubmissions } from "@/lib/submissions/repository"
import { getProblemById } from "@/lib/problems/repository"
import { freshDb, setTestDb, sessionFor, type Queryable } from "@/lib/test-support/db"

// Mock Piston — external HTTP; tested separately
vi.mock("@/lib/piston", () => ({
  runTestCases: vi.fn(),
}))

import { runTestCases } from "@/lib/piston"
const mockRun = vi.mocked(runTestCases)

function gradeReq(body: unknown, token?: string): NextRequest {
  const r = new NextRequest("http://localhost/api/grade", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (token) r.cookies.set("session", token)
  return r
}

const PAST = new Date(Date.now() - 2 * 86400_000).toISOString()
const RECENT = new Date(Date.now() - 86400_000).toISOString()
const FUTURE = new Date(Date.now() + 86400_000).toISOString()

describe("POST /api/grade", () => {
  let db: Queryable
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

    const course = await createCourse(db, { code: "C01", year: 2567, semester: 1, nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course, ins.id)
    await createEnrollment(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      userId: student.id,
    })

    await seedWeeks(db, course)
    const weeks = await listWeeks(db, course)
    const problem = await createProblem(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      weekId: weeks[0].id,
      title: "Hello",
      score: 30,
    })
    problemId = problem.id
    await setTestCases(db, problemId, [
      { input: "", expectedOutput: "Hello", isHidden: false, score: 20, sortOrder: 0 },
      { input: "", expectedOutput: "World", isHidden: true,  score: 10, sortOrder: 1 },
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

  it("returns 404 for unknown problemId", async () => {
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId: 99999, code: "print('x')", mode: "run" }, token))
    expect(res.status).toBe(404)
  })

  it("mode:run — pass all visible → pointsEarned = sum of visible tc scores", async () => {
    mockRun.mockResolvedValue([
      { testCaseId: 1, passed: true, actualOutput: "Hello", expectedOutput: "Hello", executionTime: 0 },
    ])
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId, code: "print('Hello')", mode: "run" }, token))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pointsEarned).toBe(20)
    expect(body.pointsMax).toBe(20)
    expect(body.results).toHaveLength(1)
    const calledCases = mockRun.mock.calls[0][1]
    expect(calledCases).toHaveLength(1)
    expect(calledCases[0].isHidden).toBe(false)
  })

  it("mode:run — fail visible → pointsEarned = 0", async () => {
    mockRun.mockResolvedValue([
      { testCaseId: 1, passed: false, actualOutput: "x", expectedOutput: "Hello", executionTime: 0 },
    ])
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId, code: "print('x')", mode: "run" }, token))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pointsEarned).toBe(0)
    expect(body.pointsMax).toBe(20)
  })

  it("mode:submit — pass all → pointsEarned = sum of all tc scores, stored", async () => {
    mockRun.mockResolvedValue([
      { testCaseId: 1, passed: true, actualOutput: "Hello", expectedOutput: "Hello", executionTime: 0 },
      { testCaseId: 2, passed: true, actualOutput: "World", expectedOutput: "World", executionTime: 0 },
    ])
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId, code: "print('Hello')", mode: "submit" }, token))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pointsEarned).toBe(30)
    expect(body.pointsMax).toBe(30)
    const subs = await listSubmissions(db, problemId)
    expect(subs[0].pointsEarned).toBe(30)
  })

  it("mode:submit — partial pass → partial pointsEarned, stored", async () => {
    mockRun.mockResolvedValue([
      { testCaseId: 1, passed: true,  actualOutput: "Hello", expectedOutput: "Hello", executionTime: 0 },
      { testCaseId: 2, passed: false, actualOutput: "x",     expectedOutput: "World", executionTime: 0 },
    ])
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId, code: "print('Hello')", mode: "submit" }, token))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pointsEarned).toBe(20)
    expect(body.pointsMax).toBe(30)
    const subs = await listSubmissions(db, problemId)
    expect(subs[0].pointsEarned).toBe(20)
  })

  // ── Deadline enforcement ─────────────────────────────────────────────────

  it("mode:submit past close_at → 403, no submission stored", async () => {
    const course = await createCourse(db, { code: "C02", year: 2567, semester: 1, nameTh: "ข", nameEn: "B" })
    await seedWeeks(db, course)
    const weeks = await listWeeks(db, course)
    const p = await createProblem(db, {
      courseCode: course.code, courseYear: course.year, courseSemester: course.semester,
      weekId: weeks[0].id, title: "Closed",
      dueAt: PAST, closeAt: RECENT,
    })
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId: p.id, code: "print('x')", mode: "submit" }, token))
    expect(res.status).toBe(403)
    const subs = await listSubmissions(db, p.id)
    expect(subs).toHaveLength(0)
  })

  it("mode:submit past due_at but before close_at → 200, is_late = true", async () => {
    const course = await createCourse(db, { code: "C03", year: 2567, semester: 1, nameTh: "ค", nameEn: "C" })
    const student = await createUser(db, { email: "student2@kmitl.ac.th", name: "S2", idCode: "64010002" })
    await assignRole(db, student.id, "Student")
    await createEnrollment(db, { courseCode: course.code, courseYear: course.year, courseSemester: course.semester, userId: student.id })
    await seedWeeks(db, course)
    const weeks = await listWeeks(db, course)
    const p = await createProblem(db, {
      courseCode: course.code, courseYear: course.year, courseSemester: course.semester,
      weekId: weeks[0].id, title: "Late",
      dueAt: RECENT, closeAt: FUTURE,
    })
    await setTestCases(db, p.id, [
      { input: "", expectedOutput: "x", isHidden: false, sortOrder: 0 },
    ])
    mockRun.mockResolvedValue([
      { testCaseId: 1, passed: true, actualOutput: "x", expectedOutput: "x", executionTime: 0 },
    ])
    const token = sessionFor("student2@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId: p.id, code: "print('x')", mode: "submit" }, token))
    expect(res.status).toBe(200)
    const subs = await listSubmissions(db, p.id)
    expect(subs).toHaveLength(1)
    expect(subs[0].isLate).toBe(true)
  })

  it("mode:submit before due_at → 200, is_late = false, submission stored", async () => {
    mockRun.mockResolvedValue([
      { testCaseId: 1, passed: true, actualOutput: "Hello", expectedOutput: "Hello", executionTime: 0 },
      { testCaseId: 2, passed: true, actualOutput: "World", expectedOutput: "World", executionTime: 0 },
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
    const token = sessionFor("other@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId, code: "print('x')", mode: "submit" }, token))
    expect(res.status).toBe(403)
  })

  it("no deadlines (both NULL) → 200, is_late = false", async () => {
    mockRun.mockResolvedValue([
      { testCaseId: 1, passed: true, actualOutput: "Hello", expectedOutput: "Hello", executionTime: 0 },
      { testCaseId: 2, passed: true, actualOutput: "World", expectedOutput: "World", executionTime: 0 },
    ])
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId, code: "print('Hello')", mode: "submit" }, token))
    expect(res.status).toBe(200)
    const subs = await listSubmissions(db, problemId)
    expect(subs[0].isLate).toBe(false)
  })

  it("mode:run → 200, no submission stored", async () => {
    mockRun.mockResolvedValue([
      { testCaseId: 1, passed: true, actualOutput: "Hello", expectedOutput: "Hello", executionTime: 0 },
    ])
    const token = sessionFor("student@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId, code: "print('Hello')", mode: "run" }, token))
    expect(res.status).toBe(200)
    const subs = await listSubmissions(db, problemId)
    expect(subs).toHaveLength(0)
  })

  // ── Per-test-case scoring ────────────────────────────────────────────────

  it("per-test-case scoring: pass 1 of 2 → pointsEarned = score of passing case", async () => {
    const course = await createCourse(db, { code: "C10", year: 2567, semester: 1, nameTh: "ก", nameEn: "A" })
    await seedWeeks(db, course)
    const weeks = await listWeeks(db, course)
    const student = await createUser(db, { email: "s10@kmitl.ac.th", name: "S10", idCode: "10" })
    await assignRole(db, student.id, "Student")
    await createEnrollment(db, { courseCode: course.code, courseYear: course.year, courseSemester: course.semester, userId: student.id })
    const p = await createProblem(db, {
      courseCode: course.code, courseYear: course.year, courseSemester: course.semester,
      weekId: weeks[0].id, title: "Scoring Q", score: 30,
    })
    await setTestCases(db, p.id, [
      { input: "", expectedOutput: "A", isHidden: false, score: 20, sortOrder: 0 },
      { input: "", expectedOutput: "B", isHidden: false, score: 10, sortOrder: 1 },
    ])
    const detail = await getProblemById(db, p.id)
    const [tc1, tc2] = detail!.testCases
    mockRun.mockResolvedValue([
      { testCaseId: tc1.id, passed: true,  actualOutput: "A", expectedOutput: "A", executionTime: 0 },
      { testCaseId: tc2.id, passed: false, actualOutput: "x", expectedOutput: "B", executionTime: 0 },
    ])
    const token = sessionFor("s10@kmitl.ac.th")
    const res = await POST(gradeReq({ problemId: p.id, code: "print('A')", mode: "submit" }, token))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pointsEarned).toBe(20)
    expect(body.pointsMax).toBe(30)
  })
})
