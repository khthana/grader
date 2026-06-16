import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { NextRequest } from "next/server"
import { GET } from "./route"
import { setTestDb } from "@/lib/db"
import { createUser, assignRole, type Queryable } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { createSessionToken } from "@/lib/auth"

const schema = readFileSync(
  fileURLToPath(new URL("../../../../../../schema.sql", import.meta.url)),
  "utf8"
)

function freshDb(): Queryable {
  const mem = newDb()
  mem.public.none(schema)
  const { Pool } = mem.adapters.createPg()
  return new Pool() as unknown as Queryable
}

function req(courseId: number, query = "", sessionToken?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/courses/${courseId}/students${query}`)
  if (sessionToken) r.cookies.set("session", sessionToken)
  return r
}

const ctx = (courseId: number) => ({ params: Promise.resolve({ id: String(courseId) }) })
const sessionFor = (email: string) => createSessionToken({ email, name: "x" })

describe("GET /api/courses/[id]/students", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })

  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    const res = await GET(req(course.id), ctx(course.id))
    expect(res.status).toBe(401)
  })

  it("returns 403 for an instructor not assigned to the course", async () => {
    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, ins.id, "Instructor")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })

    const res = await GET(req(course.id, "", sessionFor("ins@kmitl.ac.th")), ctx(course.id))
    expect(res.status).toBe(403)
  })

  it("returns the paged roster for an entitled instructor", async () => {
    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, ins.id, "Instructor")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course.id, ins.id)

    const stu = await createUser(db, {
      email: "65010100@kmitl.ac.th",
      name: "นักศึกษา หนึ่ง",
      idCode: "65010100",
      titleTh: "นาย",
    })
    await createEnrollment(db, { courseId: course.id, userId: stu.id, studyGroup: "1" })

    const res = await GET(req(course.id, "", sessionFor("ins@kmitl.ac.th")), ctx(course.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(10)
    expect(body.enrollments).toHaveLength(1)
    expect(body.enrollments[0].sid).toBe("65010100")
  })

  it("includes the course's distinct groups for the filter", async () => {
    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, ins.id, "Instructor")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course.id, ins.id)
    const s1 = await createUser(db, { email: "a@kmitl.ac.th", name: "A" })
    const s2 = await createUser(db, { email: "b@kmitl.ac.th", name: "B" })
    await createEnrollment(db, { courseId: course.id, userId: s1.id, studyGroup: "2" })
    await createEnrollment(db, { courseId: course.id, userId: s2.id, studyGroup: "1" })

    const res = await GET(req(course.id, "", sessionFor("ins@kmitl.ac.th")), ctx(course.id))
    const body = await res.json()
    expect(body.groups).toEqual(["1", "2"])
  })
})
