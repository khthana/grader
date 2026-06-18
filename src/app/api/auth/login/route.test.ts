import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"
import { createUser } from "@/lib/users/repository"
import { hashPassword } from "@/lib/password"
import { verifySessionToken } from "@/lib/auth"
import { freshDb, setTestDb, type Queryable } from "@/lib/test-support/db"

function loginRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/login", () => {
  let db: Queryable

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    // Deliberately a user that does NOT exist in the legacy in-memory store,
    // so the test proves login reads from the injected Postgres-backed repo.
    await createUser(db, {
      email: "teacher@kmitl.ac.th",
      name: "Jane Teacher",
      passwordHash: await hashPassword("Secret123!"),
    })
  })

  afterEach(() => setTestDb(null))

  it("returns 400 when email or password is missing", async () => {
    const res = await POST(loginRequest({ email: "admin@kmitl.ac.th" }))
    expect(res.status).toBe(400)
  })

  it("returns 403 for an unregistered email", async () => {
    const res = await POST(loginRequest({ email: "ghost@kmitl.ac.th", password: "x" }))
    expect(res.status).toBe(403)
  })

  it("returns 401 for a wrong password", async () => {
    const res = await POST(loginRequest({ email: "teacher@kmitl.ac.th", password: "wrong" }))
    expect(res.status).toBe(401)
  })

  it("returns 200 and sets a valid HttpOnly session cookie on success", async () => {
    const res = await POST(loginRequest({ email: "teacher@kmitl.ac.th", password: "Secret123!" }))
    expect(res.status).toBe(200)

    const cookie = res.cookies.get("session")
    expect(cookie).toBeDefined()
    expect(cookie?.httpOnly).toBe(true)

    const payload = verifySessionToken(cookie!.value)
    expect(payload?.email).toBe("teacher@kmitl.ac.th")
    expect(payload?.name).toBe("Jane Teacher")
  })
})
