import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { NextRequest } from "next/server"
import { GET } from "./route"
import { setTestDb } from "@/lib/db"
import { createUser, assignRole, type Queryable } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { createSessionToken } from "@/lib/auth"

const schema = readFileSync(
  fileURLToPath(new URL("../../../../schema.sql", import.meta.url)),
  "utf8"
)

function freshDb(): Queryable {
  const mem = newDb()
  mem.public.none(schema)
  const { Pool } = mem.adapters.createPg()
  return new Pool() as unknown as Queryable
}

function req(sessionToken?: string): NextRequest {
  const r = new NextRequest("http://localhost/api/courses")
  if (sessionToken) r.cookies.set("session", sessionToken)
  return r
}

const sessionFor = (email: string) => createSessionToken({ email, name: "x" })

describe("GET /api/courses", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })

  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it("returns every course for an Admin", async () => {
    const admin = await createUser(db, { email: "admin@kmitl.ac.th", name: "Admin" })
    await assignRole(db, admin.id, "Admin")
    await createCourse(db, { code: "C1", nameTh: "หนึ่ง", nameEn: "One" })
    await createCourse(db, { code: "C2", nameTh: "สอง", nameEn: "Two" })

    const res = await GET(req(sessionFor("admin@kmitl.ac.th")))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courses.map((c: { code: string }) => c.code).sort()).toEqual(["C1", "C2"])
  })

  it("returns only assigned courses for an Instructor", async () => {
    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, ins.id, "Instructor")
    const mine = await createCourse(db, { code: "MINE", nameTh: "ของฉัน", nameEn: "Mine" })
    await createCourse(db, { code: "OTHER", nameTh: "อื่น", nameEn: "Other" })
    await assignInstructor(db, mine.id, ins.id)

    const res = await GET(req(sessionFor("ins@kmitl.ac.th")))
    const body = await res.json()
    expect(body.courses.map((c: { code: string }) => c.code)).toEqual(["MINE"])
  })
})
