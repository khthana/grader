import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { NextRequest } from "next/server"
import { POST } from "./route"
import { setTestDb } from "@/lib/db"
import { createUser, assignRole, findUserByEmail, type Queryable } from "@/lib/users/repository"
import { verifyPassword } from "@/lib/password"
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

function postReq(body: unknown, sessionToken?: string): NextRequest {
  const r = new NextRequest("http://localhost/api/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (sessionToken) r.cookies.set("session", sessionToken)
  return r
}

const adminSession = () => createSessionToken({ email: "admin@kmitl.ac.th", name: "Admin" })

const validBody = {
  firstNameTh: "สมชาย",
  lastNameTh: "ใจดี",
  email: "somchai@kmitl.ac.th",
  idCode: "64010001",
}

describe("POST /api/users", () => {
  let db: Queryable

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    const admin = await createUser(db, { email: "admin@kmitl.ac.th", name: "Admin", idCode: "0" })
    await assignRole(db, admin.id, "Admin")
  })

  afterEach(() => setTestDb(null))

  it("returns 401 without a session", async () => {
    expect((await POST(postReq(validBody))).status).toBe(401)
  })

  it("returns 403 for a non-admin", async () => {
    const stu = await createUser(db, { email: "stu@kmitl.ac.th", name: "Stu", idCode: "1" })
    await assignRole(db, stu.id, "Student")
    const res = await POST(postReq(validBody, createSessionToken({ email: "stu@kmitl.ac.th", name: "Stu" })))
    expect(res.status).toBe(403)
  })

  it("returns 400 with field errors for invalid input", async () => {
    const res = await POST(postReq({ firstNameTh: "", email: "bad", idCode: "" }, adminSession()))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.errors.firstNameTh).toBeDefined()
    expect(body.errors.email).toBeDefined()
    expect(body.errors.idCode).toBeDefined()
  })

  it("creates a user with a bcrypt password and assigned roles", async () => {
    const res = await POST(
      postReq({ ...validBody, password: "Password123", roles: ["Student", "TA"] }, adminSession())
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.email).toBe("somchai@kmitl.ac.th")
    expect(body.name).toBe("สมชาย ใจดี") // derived from Thai first + last
    expect([...body.roles].sort()).toEqual(["Student", "TA"])

    const stored = await findUserByEmail(db, "somchai@kmitl.ac.th")
    expect(stored?.passwordHash).toBeTruthy()
    expect(await verifyPassword("Password123", stored!.passwordHash!)).toBe(true)
  })

  it("creates a passwordless user when no password is given", async () => {
    const res = await POST(postReq(validBody, adminSession()))
    expect(res.status).toBe(201)
    const stored = await findUserByEmail(db, "somchai@kmitl.ac.th")
    expect(stored?.passwordHash).toBeNull()
  })

  it("returns 409 when the email is already taken", async () => {
    await POST(postReq(validBody, adminSession()))
    const res = await POST(postReq(validBody, adminSession()))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.errors.email).toBeDefined()
  })
})
