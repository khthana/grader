import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, PUT } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createSessionToken } from "@/lib/auth"
import { freshDb, setTestDb, type Queryable } from "@/lib/test-support/db"

function getReq(sessionToken?: string): NextRequest {
  const r = new NextRequest("http://localhost/api/profile")
  if (sessionToken) r.cookies.set("session", sessionToken)
  return r
}

function putReq(body: unknown, sessionToken?: string): NextRequest {
  const r = new NextRequest("http://localhost/api/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (sessionToken) r.cookies.set("session", sessionToken)
  return r
}

describe("GET /api/profile", () => {
  let db: Queryable

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
  })

  afterEach(() => setTestDb(null))

  it("returns 401 without a session", async () => {
    expect((await GET(getReq())).status).toBe(401)
  })

  it("returns profile data for authenticated user", async () => {
    const u = await createUser(db, {
      email: "stu@kmitl.ac.th",
      name: "สมชาย",
      passwordHash: "hashed",
    })
    await assignRole(db, u.id, "Student")
    const session = createSessionToken({ email: "stu@kmitl.ac.th", name: "สมชาย" })

    const res = await GET(getReq(session))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.email).toBe("stu@kmitl.ac.th")
    expect(body.name).toBe("สมชาย")
    expect(body.nickname).toBeNull()
    expect(body.roles).toContain("Student")
    expect(body.hasPassword).toBe(true)
  })

  it("hasPassword is false for Google-only accounts", async () => {
    const u = await createUser(db, {
      email: "google@kmitl.ac.th",
      name: "Google User",
      passwordHash: null,
    })
    await assignRole(db, u.id, "Student")
    const session = createSessionToken({ email: "google@kmitl.ac.th", name: "Google User" })

    const res = await GET(getReq(session))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.hasPassword).toBe(false)
  })
})

describe("PUT /api/profile", () => {
  let db: Queryable
  let session: string

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    const u = await createUser(db, { email: "ins@kmitl.ac.th", name: "อาจารย์", passwordHash: "h" })
    await assignRole(db, u.id, "Instructor")
    session = createSessionToken({ email: "ins@kmitl.ac.th", name: "อาจารย์" })
  })

  afterEach(() => setTestDb(null))

  it("returns 401 without a session", async () => {
    expect((await PUT(putReq({ nickname: "Nick" }))).status).toBe(401)
  })

  it("saves nickname and GET returns updated value", async () => {
    const res = await PUT(putReq({ nickname: "น้องมิ้ว" }, session))
    expect(res.status).toBe(200)

    const getRes = await GET(getReq(session))
    const body = await getRes.json()
    expect(body.nickname).toBe("น้องมิ้ว")
  })

  it("returns 400 when nickname is too long", async () => {
    const res = await PUT(putReq({ nickname: "น".repeat(51) }, session))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.errors.nickname).toBeDefined()
  })
})
