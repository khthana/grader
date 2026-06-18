import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { seedWeeks, listWeeks } from "@/lib/weeks/repository"
import { createProblem, setTestCases } from "@/lib/problems/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { createSubmission } from "@/lib/submissions/repository"
import { freshDb, setTestDb, sessionFor, type Queryable } from "@/lib/test-support/db"

function makeCtx(courseId: number) {
  return { params: Promise.resolve({ id: String(courseId) }) }
}

function req(courseId: number, token?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/courses/${courseId}/assignments`, { method: "GET" })
  if (token) r.cookies.set("session", token)
  return r
}

describe("GET /api/courses/[id]/assignments", () => {
  let db: Queryable
  let courseId: number
  let problemId: number
  let studentId: number

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)

    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, ins.id, "Instructor")
    const student = await createUser(db, { email: "stu@kmitl.ac.th", name: "Stu", idCode: "64010001" })
    await assignRole(db, student.id, "Student")
    studentId = student.id

    const course = await createCourse(db, { code: "C01", nameTh: "ก", nameEn: "A" })
    courseId = course.id
    await assignInstructor(db, courseId, ins.id)

    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)
    const problem = await createProblem(db, { courseId, weekId: weeks[0].id, title: "Q1" })
    problemId = problem.id
    await setTestCases(db, problemId, [
      { input: "", expectedOutput: "ok", isHidden: false, score: 10, sortOrder: 0 },
    ])
    await createEnrollment(db, { courseId, userId: studentId })
  })

  afterEach(() => setTestDb(null))

  it("returns 401 without session", async () => {
    const res = await GET(req(courseId), makeCtx(courseId))
    expect(res.status).toBe(401)
  })

  it("returns 403 for non-entitled user", async () => {
    const stranger = await createUser(db, { email: "other@kmitl.ac.th", name: "Other" })
    await assignRole(db, stranger.id, "Student")
    const res = await GET(req(courseId, sessionFor("other@kmitl.ac.th")), makeCtx(courseId))
    expect(res.status).toBe(403)
  })

  it("returns 200 with assignments scoped to the calling user", async () => {
    await createSubmission(db, {
      problemId, userId: studentId, courseId,
      code: "x", language: "python",
      pointsEarned: 6, pointsMax: 10, isLate: false, results: [],
    })

    const res = await GET(req(courseId, sessionFor("stu@kmitl.ac.th")), makeCtx(courseId))
    expect(res.status).toBe(200)

    const { assignments } = await res.json()
    expect(assignments).toHaveLength(1)
    expect(assignments[0].title).toBe("Q1")
    expect(assignments[0].pointsMax).toBe(10)
    expect(assignments[0].submission.effectiveScore).toBe(6)
  })
})
