import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { NextRequest } from "next/server"
import { GET } from "./route"
import { setTestDb } from "@/lib/db"
import { createUser, assignRole, type Queryable } from "@/lib/users/repository"
import { writeLog } from "@/lib/logs"
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

function req(query = "", token?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/logs${query}`)
  if (token) r.cookies.set("session", token)
  return r
}

const admin = () => createSessionToken({ email: "admin@kmitl.ac.th", name: "Admin" })

describe("GET /api/logs", () => {
  let db: Queryable

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    const a = await createUser(db, { email: "admin@kmitl.ac.th", name: "Admin", idCode: "0" })
    await assignRole(db, a.id, "Admin")
    await writeLog(db, { action: "user.create", actorEmail: "admin@kmitl.ac.th" })
    await writeLog(db, { action: "login", actorEmail: "admin@kmitl.ac.th" })
  })

  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    expect((await GET(req())).status).toBe(401)
  })

  it("returns 403 for a non-admin", async () => {
    const stu = await createUser(db, { email: "s@kmitl.ac.th", name: "S", idCode: "1" })
    await assignRole(db, stu.id, "Student")
    expect((await GET(req("", createSessionToken({ email: "s@kmitl.ac.th", name: "S" })))).status).toBe(403)
  })

  it("returns the paginated log list for an admin", async () => {
    const res = await GET(req("", admin()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(2)
    expect(body.page).toBe(1)
    expect(body.logs).toHaveLength(2)
  })

  it("filters by action", async () => {
    const res = await GET(req("?action=login", admin()))
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.logs[0].action).toBe("login")
  })
})
