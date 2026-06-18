import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, PUT } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor, listCoursesForUser } from "@/lib/courses/repository"
import { freshDb, setTestDb, sessionFor, type Queryable } from "@/lib/test-support/db"

function putReq(courseId: number, userIds: number[], token?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/courses/${courseId}/instructors`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userIds }),
  })
  if (token) r.cookies.set("session", token)
  return r
}
function getReq(courseId: number, token?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/courses/${courseId}/instructors`)
  if (token) r.cookies.set("session", token)
  return r
}

const ctx = (courseId: number) => ({ params: Promise.resolve({ id: String(courseId) }) })

async function seedInstructorCourse(db: Queryable, email = "ins@kmitl.ac.th", code = "C") {
  const ins = await createUser(db, { email, name: "Ins" })
  await assignRole(db, ins.id, "Instructor")
  const course = await createCourse(db, { code, nameTh: "ก", nameEn: "A" })
  await assignInstructor(db, course.id, ins.id)
  return { ins, course, email }
}

async function makeInstructor(db: Queryable, email: string) {
  const u = await createUser(db, { email, name: email })
  await assignRole(db, u.id, "Instructor")
  return u
}

describe("PUT /api/courses/[id]/instructors", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })
  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    const { course } = await seedInstructorCourse(db)
    const res = await PUT(putReq(course.id, []), ctx(course.id))
    expect(res.status).toBe(401)
  })

  it("returns 403 for a TA (cannot assign staff)", async () => {
    const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
    await assignRole(db, ta.id, "TA")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course.id, ta.id)

    const res = await PUT(putReq(course.id, [], sessionFor("ta@kmitl.ac.th")), ctx(course.id))
    expect(res.status).toBe(403)
  })

  it("returns 403 for an instructor not assigned to the course", async () => {
    const a = await seedInstructorCourse(db, "a@kmitl.ac.th", "AAA")
    const b = await seedInstructorCourse(db, "b@kmitl.ac.th", "BBB")
    const res = await PUT(putReq(b.course.id, [], sessionFor(a.email)), ctx(b.course.id))
    expect(res.status).toBe(403)
  })

  it("replaces the staff set, logs course.staff, and the new staff sees the course", async () => {
    const { course, ins, email } = await seedInstructorCourse(db)
    const newcomer = await makeInstructor(db, "new@kmitl.ac.th")

    const res = await PUT(putReq(course.id, [ins.id, newcomer.id], sessionFor(email)), ctx(course.id))
    expect(res.status).toBe(200)

    const seen = await listCoursesForUser(db, newcomer.id, ["Instructor"])
    expect(seen.map((c) => c.code)).toEqual(["C"])

    const logs = await db.query<{ action: string }>(
      "SELECT action FROM user_logs WHERE action = 'course.staff'"
    )
    expect(logs.rows).toHaveLength(1)
  })
})

describe("GET /api/courses/[id]/instructors", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })
  afterEach(() => setTestDb(null))

  it("returns the course's current staff", async () => {
    const { course, ins, email } = await seedInstructorCourse(db)
    const res = await GET(getReq(course.id, sessionFor(email)), ctx(course.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.instructors.map((s: { id: number }) => s.id)).toEqual([ins.id])
  })
})
