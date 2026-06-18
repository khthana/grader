import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, POST } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { seedWeeks, listWeeks } from "@/lib/weeks/repository"
import { freshDb, setTestDb, sessionFor, type Queryable } from "@/lib/test-support/db"

function makeCtx(courseId: number) {
  return { params: Promise.resolve({ id: String(courseId) }) }
}

function getReq(courseId: number, token?: string, weekId?: number): NextRequest {
  const url = `http://localhost/api/courses/${courseId}/problems${weekId != null ? `?week=${weekId}` : ""}`
  const r = new NextRequest(url)
  if (token) r.cookies.set("session", token)
  return r
}

function postReq(courseId: number, body: unknown, token?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/courses/${courseId}/problems`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (token) r.cookies.set("session", token)
  return r
}

describe("GET /api/courses/[id]/problems", () => {
  let db: Queryable
  let courseId: number

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    const admin = await createUser(db, { email: "admin@kmitl.ac.th", name: "Admin" })
    await assignRole(db, admin.id, "Admin")
    const course = await createCourse(db, { code: "C01", nameTh: "ก", nameEn: "A" })
    courseId = course.id
    await assignInstructor(db, courseId, admin.id)
    await seedWeeks(db, courseId)
  })
  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    const res = await GET(getReq(courseId), makeCtx(courseId))
    expect(res.status).toBe(401)
  })

  it("returns 403 for a non-entitled user", async () => {
    await createUser(db, { email: "other@kmitl.ac.th", name: "Other" })
    const res = await GET(getReq(courseId, sessionFor("other@kmitl.ac.th")), makeCtx(courseId))
    expect(res.status).toBe(403)
  })

  it("returns 200 with empty list", async () => {
    const res = await GET(getReq(courseId, sessionFor("admin@kmitl.ac.th")), makeCtx(courseId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.problems).toEqual([])
  })
})

describe("POST /api/courses/[id]/problems", () => {
  let db: Queryable
  let courseId: number
  let weekId: number

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, ins.id, "Instructor")
    const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
    await assignRole(db, ta.id, "TA")
    const course = await createCourse(db, { code: "C01", nameTh: "ก", nameEn: "A" })
    courseId = course.id
    await assignInstructor(db, courseId, ins.id)
    await assignInstructor(db, courseId, ta.id)
    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)
    weekId = weeks[0].id
  })
  afterEach(() => setTestDb(null))

  it("returns 403 for TA", async () => {
    const res = await POST(
      postReq(courseId, { title: "Q", weekId, testCases: [{ input: "", expectedOutput: "", isHidden: false, score: 10, sortOrder: 0 }] }, sessionFor("ta@kmitl.ac.th")),
      makeCtx(courseId)
    )
    expect(res.status).toBe(403)
  })

  it("returns 400 for invalid input (no test cases)", async () => {
    const res = await POST(
      postReq(courseId, { title: "Q", weekId, testCases: [] }, sessionFor("ins@kmitl.ac.th")),
      makeCtx(courseId)
    )
    expect(res.status).toBe(400)
  })

  it("creates problem + test cases and logs problem.create", async () => {
    const body = {
      title: "Hello World",
      weekId,
      description: "desc",
      testCases: [{ input: "a", expectedOutput: "A", isHidden: false, score: 10, sortOrder: 0 }],
    }
    const res = await POST(postReq(courseId, body, sessionFor("ins@kmitl.ac.th")), makeCtx(courseId))
    expect(res.status).toBe(201)
    const { problem } = await res.json()
    expect(problem.title).toBe("Hello World")
    expect(problem.testCases).toHaveLength(1)

    const { rows } = await db.query<{ action: string }>(
      `SELECT action FROM user_logs WHERE action = 'problem.create'`
    )
    expect(rows).toHaveLength(1)
  })
})
