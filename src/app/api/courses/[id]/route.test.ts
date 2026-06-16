import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { NextRequest } from "next/server"
import { GET, PUT, DELETE } from "./route"
import { setTestDb } from "@/lib/db"
import { createUser, assignRole, type Queryable } from "@/lib/users/repository"
import {
  createCourse,
  assignInstructor,
  getCourseById,
} from "@/lib/courses/repository"
import { createEnrollment, getEnrollmentById } from "@/lib/enrollments/repository"
import { createSessionToken } from "@/lib/auth"

const schema = readFileSync(
  fileURLToPath(new URL("../../../../../schema.sql", import.meta.url)),
  "utf8"
)

function freshDb(): Queryable {
  const mem = newDb()
  mem.public.none(schema)
  const { Pool } = mem.adapters.createPg()
  return new Pool() as unknown as Queryable
}

function getReq(id: number, token?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/courses/${id}`)
  if (token) r.cookies.set("session", token)
  return r
}
function putReq(id: number, body: unknown, token?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/courses/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (token) r.cookies.set("session", token)
  return r
}
function delReq(id: number, token?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/courses/${id}`, { method: "DELETE" })
  if (token) r.cookies.set("session", token)
  return r
}

const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
const sessionFor = (email: string) => createSessionToken({ email, name: "x" })

async function seedInstructorCourse(db: Queryable, email = "ins@kmitl.ac.th", code = "C") {
  const ins = await createUser(db, { email, name: "Ins" })
  await assignRole(db, ins.id, "Instructor")
  const course = await createCourse(db, { code, nameTh: "ก", nameEn: "A" })
  await assignInstructor(db, course.id, ins.id)
  return { ins, course, email }
}

const edit = { code: "NEW", nameTh: "ใหม่", nameEn: "New", program: "ข" }

describe("PUT /api/courses/[id]", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })
  afterEach(() => setTestDb(null))

  it("returns 403 for a TA (no course management)", async () => {
    const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
    await assignRole(db, ta.id, "TA")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course.id, ta.id)

    const res = await PUT(putReq(course.id, edit, sessionFor("ta@kmitl.ac.th")), ctx(course.id))
    expect(res.status).toBe(403)
  })

  it("returns 403 for an instructor not assigned to the course", async () => {
    const a = await seedInstructorCourse(db, "a@kmitl.ac.th", "AAA")
    const b = await seedInstructorCourse(db, "b@kmitl.ac.th", "BBB")
    const res = await PUT(putReq(b.course.id, edit, sessionFor(a.email)), ctx(b.course.id))
    expect(res.status).toBe(403)
  })

  it("updates the course and logs course.update", async () => {
    const { course, email } = await seedInstructorCourse(db)
    const res = await PUT(putReq(course.id, edit, sessionFor(email)), ctx(course.id))
    expect(res.status).toBe(200)

    const found = await getCourseById(db, course.id)
    expect(found?.code).toBe("NEW")
    expect(found?.program).toBe("ข")

    const logs = await db.query<{ action: string }>(
      "SELECT action FROM user_logs WHERE action = 'course.update'"
    )
    expect(logs.rows).toHaveLength(1)
  })
})

describe("DELETE /api/courses/[id]", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })
  afterEach(() => setTestDb(null))

  it("returns 403 for a TA", async () => {
    const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
    await assignRole(db, ta.id, "TA")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course.id, ta.id)

    const res = await DELETE(delReq(course.id, sessionFor("ta@kmitl.ac.th")), ctx(course.id))
    expect(res.status).toBe(403)
  })

  it("deletes the course, cascades enrollments, and logs course.delete", async () => {
    const { course, email } = await seedInstructorCourse(db)
    const stu = await createUser(db, { email: "s@kmitl.ac.th", name: "S", idCode: "1" })
    const enrollment = await createEnrollment(db, { courseId: course.id, userId: stu.id })

    const res = await DELETE(delReq(course.id, sessionFor(email)), ctx(course.id))
    expect(res.status).toBe(200)

    expect(await getCourseById(db, course.id)).toBeNull()
    expect(await getEnrollmentById(db, enrollment.id)).toBeNull()

    const logs = await db.query<{ action: string }>(
      "SELECT action FROM user_logs WHERE action = 'course.delete'"
    )
    expect(logs.rows).toHaveLength(1)
  })
})

describe("GET /api/courses/[id]", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })
  afterEach(() => setTestDb(null))

  it("returns the course detail for an entitled instructor", async () => {
    const { course, email } = await seedInstructorCourse(db)
    const res = await GET(getReq(course.id, sessionFor(email)), ctx(course.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.code).toBe("C")
  })
})
