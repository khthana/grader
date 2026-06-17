import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { NextRequest } from "next/server"
import { GET, POST } from "./route"
import { setTestDb } from "@/lib/db"
import { createUser, assignRole, type Queryable } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { listWeeks } from "@/lib/weeks/repository"
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

function postReq(body: unknown, token?: string): NextRequest {
  const r = new NextRequest("http://localhost/api/courses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (token) r.cookies.set("session", token)
  return r
}

const sessionFor = (email: string) => createSessionToken({ email, name: "x" })

async function seedRole(db: Queryable, email: string, role: string) {
  const u = await createUser(db, { email, name: role })
  await assignRole(db, u.id, role)
  return u
}

const newCourse = { code: "01076021", nameTh: "โครงสร้างข้อมูล", nameEn: "Data Structures" }

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

describe("POST /api/courses", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })
  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    const res = await POST(postReq(newCourse))
    expect(res.status).toBe(401)
  })

  it("returns 403 for a TA (no course management)", async () => {
    await seedRole(db, "ta@kmitl.ac.th", "TA")
    const res = await POST(postReq(newCourse, sessionFor("ta@kmitl.ac.th")))
    expect(res.status).toBe(403)
  })

  it("returns 400 when required fields are missing", async () => {
    await seedRole(db, "ins@kmitl.ac.th", "Instructor")
    const res = await POST(postReq({ code: "", nameTh: "", nameEn: "" }, sessionFor("ins@kmitl.ac.th")))
    expect(res.status).toBe(400)
  })

  it("creates the course, assigns the creator, and logs course.create", async () => {
    const ins = await seedRole(db, "ins@kmitl.ac.th", "Instructor")

    const res = await POST(postReq(newCourse, sessionFor("ins@kmitl.ac.th")))
    expect(res.status).toBe(201)

    // appears in the creator's entitled courses (switcher)
    const list = await GET(req(sessionFor("ins@kmitl.ac.th")))
    const body = await list.json()
    expect(body.courses.map((c: { code: string }) => c.code)).toEqual(["01076021"])

    const logs = await db.query<{ action: string }>(
      "SELECT action FROM user_logs WHERE action = 'course.create'"
    )
    expect(logs.rows).toHaveLength(1)
    void ins
  })

  it("seeds 8 weeks for the newly created course", async () => {
    await seedRole(db, "ins@kmitl.ac.th", "Instructor")
    const res = await POST(postReq(newCourse, sessionFor("ins@kmitl.ac.th")))
    expect(res.status).toBe(201)
    const { id: courseId } = await res.json()
    const weeks = await listWeeks(db, courseId)
    expect(weeks).toHaveLength(8)
    expect(weeks[0].topic).toBe("สัปดาห์ที่ 1")
  })

  it("returns 409 for a duplicate course code", async () => {
    await seedRole(db, "ins@kmitl.ac.th", "Instructor")
    await POST(postReq(newCourse, sessionFor("ins@kmitl.ac.th")))

    const dup = await POST(postReq(newCourse, sessionFor("ins@kmitl.ac.th")))
    expect(dup.status).toBe(409)
  })
})
