import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { NextRequest } from "next/server"
import { POST } from "./route"
import { setTestDb } from "@/lib/db"
import { createUser, assignRole, type Queryable } from "@/lib/users/repository"
import { createSessionToken, verifySessionToken } from "@/lib/auth"

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

const sessionFor = (email: string) => createSessionToken({ email, name: "x" })

function makeCtx(id: number) {
  return { params: Promise.resolve({ id: String(id) }) }
}

function req(id: number, token?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/users/${id}/impersonate`, { method: "POST" })
  if (token) r.cookies.set("session", token)
  return r
}

describe("POST /api/users/[id]/impersonate", () => {
  let db: Queryable
  let adminId: number
  let studentId: number

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)

    const admin = await createUser(db, { email: "admin@kmitl.ac.th", name: "Admin" })
    await assignRole(db, admin.id, "Admin")
    adminId = admin.id

    const student = await createUser(db, { email: "stu@kmitl.ac.th", name: "Stu", idCode: "64010001" })
    await assignRole(db, student.id, "Student")
    studentId = student.id
  })

  afterEach(() => setTestDb(null))

  it("lets an Admin impersonate another user: session becomes the target, admin token saved, active_* cleared", async () => {
    const res = await POST(req(studentId, sessionFor("admin@kmitl.ac.th")), makeCtx(studentId))
    expect(res.status).toBe(200)

    const session = res.cookies.get("session")?.value ?? ""
    expect(verifySessionToken(session)?.email).toBe("stu@kmitl.ac.th")

    const impersonator = res.cookies.get("impersonator")?.value ?? ""
    expect(verifySessionToken(impersonator)?.email).toBe("admin@kmitl.ac.th")

    expect(res.cookies.get("active_role")?.value).toBe("")
    expect(res.cookies.get("active_course")?.value).toBe("")
  })

  it("records a user.impersonate activity log", async () => {
    await POST(req(studentId, sessionFor("admin@kmitl.ac.th")), makeCtx(studentId))
    const { rows } = await db.query<{ action: string; actor_id: number; target_id: number }>(
      `SELECT action, actor_id, target_id FROM user_logs WHERE action = 'user.impersonate'`
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].actor_id).toBe(adminId)
    expect(rows[0].target_id).toBe(studentId)
  })

  it("returns 403 for a non-Admin caller", async () => {
    const res = await POST(req(adminId, sessionFor("stu@kmitl.ac.th")), makeCtx(adminId))
    expect(res.status).toBe(403)
  })

  it("returns 404 for an unknown target user", async () => {
    const res = await POST(req(99999, sessionFor("admin@kmitl.ac.th")), makeCtx(99999))
    expect(res.status).toBe(404)
  })

  it("refuses impersonating yourself (400)", async () => {
    const res = await POST(req(adminId, sessionFor("admin@kmitl.ac.th")), makeCtx(adminId))
    expect(res.status).toBe(400)
  })

  it("is disabled in production (404)", async () => {
    vi.stubEnv("NODE_ENV", "production")
    try {
      const res = await POST(req(studentId, sessionFor("admin@kmitl.ac.th")), makeCtx(studentId))
      expect(res.status).toBe(404)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
