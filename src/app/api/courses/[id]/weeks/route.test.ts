import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { NextRequest } from "next/server"
import { GET } from "./route"
import { setTestDb } from "@/lib/db"
import { createUser, assignRole, type Queryable } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { seedWeeks } from "@/lib/weeks/repository"
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

const ctx = (courseId: number) => ({ params: Promise.resolve({ id: String(courseId) }) })
const sessionFor = (email: string) => createSessionToken({ email, name: "x" })

async function seedInstructorCourse(db: Queryable) {
  const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
  await assignRole(db, ins.id, "Instructor")
  const course = await createCourse(db, { code: "C01", nameTh: "ก", nameEn: "A" })
  await assignInstructor(db, course.id, ins.id)
  await seedWeeks(db, course.id)
  return { ins, course }
}

describe("GET /api/courses/[id]/weeks", () => {
  let db: Queryable
  beforeEach(() => { db = freshDb(); setTestDb(db) })
  afterEach(() => setTestDb(null))

  it("returns 401 when unauthenticated", async () => {
    const { course } = await seedInstructorCourse(db)
    const req = new NextRequest(`http://localhost/api/courses/${course.id}/weeks`)
    const res = await GET(req, ctx(course.id))
    expect(res.status).toBe(401)
  })

  it("returns 403 for non-entitled user", async () => {
    const { course } = await seedInstructorCourse(db)
    const other = await createUser(db, { email: "other@kmitl.ac.th", name: "Other" })
    await assignRole(db, other.id, "Instructor")
    const req = new NextRequest(`http://localhost/api/courses/${course.id}/weeks`)
    req.cookies.set("session", sessionFor("other@kmitl.ac.th"))
    const res = await GET(req, ctx(course.id))
    expect(res.status).toBe(403)
  })

  it("returns 8 weeks ordered by week_no for entitled Instructor", async () => {
    const { ins, course } = await seedInstructorCourse(db)
    const req = new NextRequest(`http://localhost/api/courses/${course.id}/weeks`)
    req.cookies.set("session", sessionFor(ins.email))
    const res = await GET(req, ctx(course.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.weeks).toHaveLength(8)
    expect(body.weeks[0].weekNo).toBe(1)
    expect(body.weeks[7].weekNo).toBe(8)
  })
})
