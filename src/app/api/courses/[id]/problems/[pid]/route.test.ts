import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { NextRequest } from "next/server"
import { GET, PUT, DELETE } from "./route"
import { setTestDb } from "@/lib/db"
import { createUser, assignRole, type Queryable } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { seedWeeks, listWeeks } from "@/lib/weeks/repository"
import { createProblem, setTestCases } from "@/lib/problems/repository"
import { createSessionToken } from "@/lib/auth"

const schema = readFileSync(
  fileURLToPath(new URL("../../../../../../../schema.sql", import.meta.url)),
  "utf8"
)

function freshDb(): Queryable {
  const mem = newDb()
  mem.public.none(schema)
  const { Pool } = mem.adapters.createPg()
  return new Pool() as unknown as Queryable
}

const sessionFor = (email: string) => createSessionToken({ email, name: "x" })

function makeCtx(courseId: number, pid: number) {
  return { params: Promise.resolve({ id: String(courseId), pid: String(pid) }) }
}

function req(method: string, courseId: number, pid: number, token?: string, body?: unknown): NextRequest {
  const r = new NextRequest(
    `http://localhost/api/courses/${courseId}/problems/${pid}`,
    body
      ? { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
      : { method }
  )
  if (token) r.cookies.set("session", token)
  return r
}

describe("GET/PUT/DELETE /api/courses/[id]/problems/[pid]", () => {
  let db: Queryable
  let courseId: number
  let weekId: number
  let problemId: number

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
    const p = await createProblem(db, { courseId, weekId, title: "Test Q" })
    problemId = p.id
    await setTestCases(db, problemId, [
      { input: "a", expectedOutput: "A", isHidden: false, score: 10, sortOrder: 0 },
    ])
  })
  afterEach(() => setTestDb(null))

  it("GET returns 404 for unknown problem id", async () => {
    const res = await GET(req("GET", courseId, 99999, sessionFor("ins@kmitl.ac.th")), makeCtx(courseId, 99999))
    expect(res.status).toBe(404)
  })

  it("GET returns 200 with problem detail and test cases", async () => {
    const res = await GET(req("GET", courseId, problemId, sessionFor("ins@kmitl.ac.th")), makeCtx(courseId, problemId))
    expect(res.status).toBe(200)
    const { problem } = await res.json()
    expect(problem.title).toBe("Test Q")
    expect(problem.testCases).toHaveLength(1)
    expect(problem.testCases[0].input).toBe("a")
  })

  it("TA can GET (read-only)", async () => {
    const res = await GET(req("GET", courseId, problemId, sessionFor("ta@kmitl.ac.th")), makeCtx(courseId, problemId))
    expect(res.status).toBe(200)
  })

  it("PUT returns 403 for TA", async () => {
    const res = await PUT(
      req("PUT", courseId, problemId, sessionFor("ta@kmitl.ac.th"), {
        title: "Changed",
        weekId,
        testCases: [{ input: "", expectedOutput: "", isHidden: false, score: 5, sortOrder: 0 }],
      }),
      makeCtx(courseId, problemId)
    )
    expect(res.status).toBe(403)
  })

  it("PUT replaces test cases atomically and logs problem.update", async () => {
    const res = await PUT(
      req("PUT", courseId, problemId, sessionFor("ins@kmitl.ac.th"), {
        title: "Updated Title",
        weekId,
        testCases: [
          { input: "x", expectedOutput: "X", isHidden: true, score: 20, sortOrder: 0 },
          { input: "y", expectedOutput: "Y", isHidden: false, score: 5, sortOrder: 1 },
        ],
      }),
      makeCtx(courseId, problemId)
    )
    expect(res.status).toBe(200)
    const { problem } = await res.json()
    expect(problem.title).toBe("Updated Title")
    expect(problem.testCases).toHaveLength(2)
    expect(problem.testCases[0].input).toBe("x")

    const { rows } = await db.query<{ action: string }>(
      `SELECT action FROM user_logs WHERE action = 'problem.update'`
    )
    expect(rows).toHaveLength(1)
  })

  it("DELETE returns 403 for TA", async () => {
    const res = await DELETE(req("DELETE", courseId, problemId, sessionFor("ta@kmitl.ac.th")), makeCtx(courseId, problemId))
    expect(res.status).toBe(403)
  })

  it("DELETE removes problem and cascades test_cases, logs problem.delete", async () => {
    const res = await DELETE(req("DELETE", courseId, problemId, sessionFor("ins@kmitl.ac.th")), makeCtx(courseId, problemId))
    expect(res.status).toBe(200)

    // second delete → 404
    const res2 = await DELETE(req("DELETE", courseId, problemId, sessionFor("ins@kmitl.ac.th")), makeCtx(courseId, problemId))
    expect(res2.status).toBe(404)

    const { rows } = await db.query<{ action: string }>(
      `SELECT action FROM user_logs WHERE action = 'problem.delete'`
    )
    expect(rows).toHaveLength(1)
  })
})
