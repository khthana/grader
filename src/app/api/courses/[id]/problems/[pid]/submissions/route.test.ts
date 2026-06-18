import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, PUT as SUB_PUT } from "./[sid]/route"
import { GET as LIST_GET } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { seedWeeks, listWeeks } from "@/lib/weeks/repository"
import { createProblem, setTestCases } from "@/lib/problems/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { createSubmission } from "@/lib/submissions/repository"
import { freshDb, setTestDb, sessionFor, type Queryable } from "@/lib/test-support/db"

function listCtx(courseId: number, pid: number) {
  return { params: Promise.resolve({ id: String(courseId), pid: String(pid) }) }
}

function sidCtx(courseId: number, pid: number, sid: number) {
  return { params: Promise.resolve({ id: String(courseId), pid: String(pid), sid: String(sid) }) }
}

function makeReq(method: string, url: string, token?: string, body?: unknown): NextRequest {
  const r = new NextRequest(url, body
    ? { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    : { method }
  )
  if (token) r.cookies.set("session", token)
  return r
}

describe("submissions API", () => {
  let db: Queryable
  let courseId: number
  let problemId: number
  let userId: number
  let instructorId: number
  let taId: number

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)

    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, ins.id, "Instructor")
    instructorId = ins.id

    const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
    await assignRole(db, ta.id, "TA")
    taId = ta.id

    const student = await createUser(db, { email: "stu@kmitl.ac.th", name: "Stu", idCode: "64010001" })
    await assignRole(db, student.id, "Student")
    userId = student.id

    const course = await createCourse(db, { code: "C01", nameTh: "ก", nameEn: "A" })
    courseId = course.id
    await assignInstructor(db, courseId, ins.id)
    await assignInstructor(db, courseId, ta.id)

    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)
    const problem = await createProblem(db, { courseId, weekId: weeks[0].id, title: "Q1" })
    problemId = problem.id
    await setTestCases(db, problemId, [{ input: "", expectedOutput: "ok", isHidden: false, score: 10, sortOrder: 0 }])
    await createEnrollment(db, { courseId, userId })
  })

  afterEach(() => setTestDb(null))

  // Behavior 8: GET list 401
  it("GET /submissions returns 401 without session", async () => {
    const res = await LIST_GET(
      makeReq("GET", `http://localhost/api/courses/${courseId}/problems/${problemId}/submissions`),
      listCtx(courseId, problemId)
    )
    expect(res.status).toBe(401)
  })

  // Behavior 9: GET list 403 non-entitled
  it("GET /submissions returns 403 for non-entitled user", async () => {
    const stranger = await createUser(db, { email: "other@kmitl.ac.th", name: "Other" })
    await assignRole(db, stranger.id, "Instructor")
    const res = await LIST_GET(
      makeReq("GET", `http://localhost/api/courses/${courseId}/problems/${problemId}/submissions`, sessionFor("other@kmitl.ac.th")),
      listCtx(courseId, problemId)
    )
    expect(res.status).toBe(403)
  })

  // Behavior 10: GET list 200
  it("GET /submissions returns 200 list with student info", async () => {
    await createSubmission(db, {
      problemId, userId, courseId,
      code: "print('hi')", language: "python",
      pointsEarned: 8, pointsMax: 10, isLate: false, results: [],
    })
    const res = await LIST_GET(
      makeReq("GET", `http://localhost/api/courses/${courseId}/problems/${problemId}/submissions`, sessionFor("ins@kmitl.ac.th")),
      listCtx(courseId, problemId)
    )
    expect(res.status).toBe(200)
    const { submissions } = await res.json()
    expect(submissions).toHaveLength(1)
    expect(submissions[0].studentIdCode).toBe("64010001")
    expect(submissions[0].effectiveScore).toBe(8)
  })

  // Behavior 11: GET detail 404
  it("GET /submissions/[sid] returns 404 for unknown submission", async () => {
    const res = await GET(
      makeReq("GET", `http://localhost/api/courses/${courseId}/problems/${problemId}/submissions/99999`, sessionFor("ins@kmitl.ac.th")),
      sidCtx(courseId, problemId, 99999)
    )
    expect(res.status).toBe(404)
  })

  // Behavior 12: GET detail 200
  it("GET /submissions/[sid] returns 200 with code", async () => {
    const sub = await createSubmission(db, {
      problemId, userId, courseId,
      code: "print('hello')", language: "python",
      pointsEarned: 10, pointsMax: 10, isLate: false, results: [],
    })
    const res = await GET(
      makeReq("GET", `http://localhost/api/courses/${courseId}/problems/${problemId}/submissions/${sub.id}`, sessionFor("ins@kmitl.ac.th")),
      sidCtx(courseId, problemId, sub.id)
    )
    expect(res.status).toBe(200)
    const { submission } = await res.json()
    expect(submission.code).toBe("print('hello')")
  })

  // Behavior 13: PUT 403 TA
  it("PUT /submissions/[sid] returns 403 for TA", async () => {
    const sub = await createSubmission(db, {
      problemId, userId, courseId,
      code: "x", language: "python",
      pointsEarned: 5, pointsMax: 10, isLate: false, results: [],
    })
    const res = await SUB_PUT(
      makeReq("PUT", `http://localhost/api/courses/${courseId}/problems/${problemId}/submissions/${sub.id}`, sessionFor("ta@kmitl.ac.th"), { manualScore: 9 }),
      sidCtx(courseId, problemId, sub.id)
    )
    expect(res.status).toBe(403)
  })

  // Behavior 14: PUT 200 sets manual_score + reviewed_at
  it("PUT /submissions/[sid] 200 sets manual_score and reviewed_at", async () => {
    const sub = await createSubmission(db, {
      problemId, userId, courseId,
      code: "x", language: "python",
      pointsEarned: 5, pointsMax: 10, isLate: false, results: [],
    })
    const res = await SUB_PUT(
      makeReq("PUT", `http://localhost/api/courses/${courseId}/problems/${problemId}/submissions/${sub.id}`, sessionFor("ins@kmitl.ac.th"), { manualScore: 9 }),
      sidCtx(courseId, problemId, sub.id)
    )
    expect(res.status).toBe(200)
    const { submission } = await res.json()
    expect(submission.manualScore).toBe(9)
    expect(submission.reviewedAt).not.toBeNull()
  })
})
