import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createSessionToken } from "@/lib/auth"
import { freshDb, setTestDb, type Queryable } from "@/lib/test-support/db"

function meRequest(sessionToken?: string): NextRequest {
  const req = new NextRequest("http://localhost/api/auth/me")
  if (sessionToken) req.cookies.set("session", sessionToken)
  return req
}

describe("GET /api/auth/me", () => {
  let db: Queryable

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    const u = await createUser(db, {
      email: "admin@kmitl.ac.th",
      name: "System Admin",
      passwordHash: "h",
    })
    await assignRole(db, u.id, "Admin")
  })

  afterEach(() => setTestDb(null))

  it("returns 401 without a session", async () => {
    const res = await GET(meRequest())
    expect(res.status).toBe(401)
  })

  it("returns 401 for a tampered session", async () => {
    const res = await GET(meRequest("garbage.token"))
    expect(res.status).toBe(401)
  })

  it("returns the current user with their roles", async () => {
    const token = createSessionToken({ email: "admin@kmitl.ac.th", name: "System Admin" })
    const res = await GET(meRequest(token))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.email).toBe("admin@kmitl.ac.th")
    expect(body.name).toBe("System Admin")
    expect(body.roles).toEqual(["Admin"])
  })
})
