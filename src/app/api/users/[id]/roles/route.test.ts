import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { NextRequest } from "next/server"
import { PUT } from "./route"
import { setTestDb } from "@/lib/db"
import { createUser, assignRole, getUserById, type Queryable } from "@/lib/users/repository"
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

const admin = () => createSessionToken({ email: "admin@kmitl.ac.th", name: "Admin" })

function rolesReq(roles: string[], token?: string): NextRequest {
  const r = new NextRequest("http://localhost/api/users/1/roles", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roles }),
  })
  if (token) r.cookies.set("session", token)
  return r
}

const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
const rolesOf = async (db: Queryable, id: number) =>
  [...((await getUserById(db, id))?.roles ?? [])].sort()

describe("PUT /api/users/[id]/roles", () => {
  let db: Queryable
  let adminId: number
  let targetId: number

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    const a = await createUser(db, { email: "admin@kmitl.ac.th", name: "Admin", idCode: "0" })
    await assignRole(db, a.id, "Admin")
    adminId = a.id
    const t = await createUser(db, { email: "t@kmitl.ac.th", name: "T", idCode: "1" })
    await assignRole(db, t.id, "Student")
    targetId = t.id
  })

  afterEach(() => setTestDb(null))

  it("returns 401 without a session", async () => {
    expect((await PUT(rolesReq(["TA"]), ctx(targetId))).status).toBe(401)
  })

  it("returns 403 for a non-admin", async () => {
    const res = await PUT(rolesReq(["TA"], createSessionToken({ email: "t@kmitl.ac.th", name: "T" })), ctx(targetId))
    expect(res.status).toBe(403)
  })

  it("returns 400 for an unknown role", async () => {
    expect((await PUT(rolesReq(["Wizard"], admin()), ctx(targetId))).status).toBe(400)
  })

  it("returns 404 for an unknown user", async () => {
    expect((await PUT(rolesReq(["TA"], admin()), ctx(9999))).status).toBe(404)
  })

  it("replaces the user's roles and returns the updated set", async () => {
    const res = await PUT(rolesReq(["Instructor", "TA"], admin()), ctx(targetId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect([...body.roles].sort()).toEqual(["Instructor", "TA"])
    expect(await rolesOf(db, targetId)).toEqual(["Instructor", "TA"])
  })

  it("blocks removing the last Admin (409) and keeps the role", async () => {
    const res = await PUT(rolesReq(["Student"], admin()), ctx(adminId))
    expect(res.status).toBe(409)
    expect(await rolesOf(db, adminId)).toContain("Admin")
  })

  it("allows demoting an Admin when another Admin remains", async () => {
    const second = await createUser(db, { email: "admin2@kmitl.ac.th", name: "Admin2", idCode: "9" })
    await assignRole(db, second.id, "Admin")

    const res = await PUT(rolesReq(["Student"], admin()), ctx(second.id))
    expect(res.status).toBe(200)
    expect(await rolesOf(db, second.id)).toEqual(["Student"])
  })
})
