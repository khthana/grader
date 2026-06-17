import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { NextRequest } from "next/server"
import { PUT, DELETE } from "./route"
import { setTestDb } from "@/lib/db"
import { createUser, assignRole, type Queryable } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { seedWeeks, listWeeks } from "@/lib/weeks/repository"
import { createProblem } from "@/lib/problems/repository"
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

const ctx = (courseId: number, wid: number) => ({
  params: Promise.resolve({ id: String(courseId), wid: String(wid) }),
})
const sessionFor = (email: string) => createSessionToken({ email, name: "x" })

async function seedAll(db: Queryable) {
  const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
  await assignRole(db, ins.id, "Instructor")
  const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
  await assignRole(db, ta.id, "TA")
  const course = await createCourse(db, { code: "C01", nameTh: "ก", nameEn: "A" })
  await assignInstructor(db, course.id, ins.id)
  await assignInstructor(db, course.id, ta.id)
  await seedWeeks(db, course.id)
  const weeks = await listWeeks(db, course.id)
  return { ins, ta, course, weeks }
}

describe("PUT /api/courses/[id]/weeks/[wid]", () => {
  let db: Queryable
  beforeEach(() => { db = freshDb(); setTestDb(db) })
  afterEach(() => setTestDb(null))

  it("returns 403 for TA", async () => {
    const { ta, course, weeks } = await seedAll(db)
    const req = new NextRequest(
      `http://localhost/api/courses/${course.id}/weeks/${weeks[0].id}`,
      { method: "PUT", body: JSON.stringify({ topic: "ใหม่" }),
        headers: { "content-type": "application/json" } }
    )
    req.cookies.set("session", sessionFor(ta.email))
    const res = await PUT(req, ctx(course.id, weeks[0].id))
    expect(res.status).toBe(403)
  })

  it("updates topic and returns updated week for Instructor", async () => {
    const { ins, course, weeks } = await seedAll(db)
    const req = new NextRequest(
      `http://localhost/api/courses/${course.id}/weeks/${weeks[0].id}`,
      { method: "PUT", body: JSON.stringify({ topic: "พื้นฐาน Python" }),
        headers: { "content-type": "application/json" } }
    )
    req.cookies.set("session", sessionFor(ins.email))
    const res = await PUT(req, ctx(course.id, weeks[0].id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.week.topic).toBe("พื้นฐาน Python")
    expect(body.week.weekNo).toBe(1)
  })
})

describe("DELETE /api/courses/[id]/weeks/[wid]", () => {
  let db: Queryable
  beforeEach(() => { db = freshDb(); setTestDb(db) })
  afterEach(() => setTestDb(null))

  it("returns 403 for a TA (read-only)", async () => {
    const { ta, course, weeks } = await seedAll(db)
    const last = weeks[weeks.length - 1]
    const req = new NextRequest(
      `http://localhost/api/courses/${course.id}/weeks/${last.id}`,
      { method: "DELETE" }
    )
    req.cookies.set("session", sessionFor(ta.email))
    const res = await DELETE(req, ctx(course.id, last.id))
    expect(res.status).toBe(403)
  })

  it("removes the last empty week for an Instructor", async () => {
    const { ins, course, weeks } = await seedAll(db)
    const last = weeks[weeks.length - 1]
    const req = new NextRequest(
      `http://localhost/api/courses/${course.id}/weeks/${last.id}`,
      { method: "DELETE" }
    )
    req.cookies.set("session", sessionFor(ins.email))
    const res = await DELETE(req, ctx(course.id, last.id))
    expect(res.status).toBe(200)
    expect(await listWeeks(db, course.id)).toHaveLength(weeks.length - 1)
  })

  it("returns 409 when removing a non-last week", async () => {
    const { ins, course, weeks } = await seedAll(db)
    const req = new NextRequest(
      `http://localhost/api/courses/${course.id}/weeks/${weeks[0].id}`,
      { method: "DELETE" }
    )
    req.cookies.set("session", sessionFor(ins.email))
    const res = await DELETE(req, ctx(course.id, weeks[0].id))
    expect(res.status).toBe(409)
    expect(await listWeeks(db, course.id)).toHaveLength(weeks.length)
  })

  it("returns 409 when the last week still holds a problem", async () => {
    const { ins, course, weeks } = await seedAll(db)
    const last = weeks[weeks.length - 1]
    await createProblem(db, { courseId: course.id, weekId: last.id, title: "โจทย์" })
    const req = new NextRequest(
      `http://localhost/api/courses/${course.id}/weeks/${last.id}`,
      { method: "DELETE" }
    )
    req.cookies.set("session", sessionFor(ins.email))
    const res = await DELETE(req, ctx(course.id, last.id))
    expect(res.status).toBe(409)
    expect(await listWeeks(db, course.id)).toHaveLength(weeks.length)
  })
})
