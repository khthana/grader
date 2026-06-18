import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, PUT, PATCH, DELETE } from "./route"
import { createUser, assignRole, getUserById } from "@/lib/users/repository"
import { createSessionToken } from "@/lib/auth"
import { freshDb, setTestDb, type Queryable } from "@/lib/test-support/db"

const admin = () => createSessionToken({ email: "admin@kmitl.ac.th", name: "Admin" })

function reqWithBody(method: string, body: unknown, token?: string): NextRequest {
  const r = new NextRequest("http://localhost/api/users/1", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (token) r.cookies.set("session", token)
  return r
}

const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })

const editBody = {
  firstNameTh: "ใหม่",
  lastNameTh: "นามใหม่",
  email: "new@kmitl.ac.th",
  idCode: "64019999",
  phone: "0899999999",
}

describe("/api/users/[id]", () => {
  let db: Queryable
  let targetId: number

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    const a = await createUser(db, { email: "admin@kmitl.ac.th", name: "Admin", idCode: "0" })
    await assignRole(db, a.id, "Admin")
    const t = await createUser(db, {
      email: "old@kmitl.ac.th",
      name: "Old",
      idCode: "64010001",
      firstNameTh: "เก่า",
      lastNameTh: "เดิม",
    })
    targetId = t.id
  })

  afterEach(() => setTestDb(null))

  // --- GET (detail) ---
  it("GET returns the user detail for an admin", async () => {
    const reqGet = (token?: string) => {
      const r = new NextRequest("http://localhost/api/users/1")
      if (token) r.cookies.set("session", token)
      return r
    }
    expect((await GET(reqGet(), ctx(targetId))).status).toBe(401)

    const res = await GET(reqGet(admin()), ctx(targetId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.email).toBe("old@kmitl.ac.th")
    expect(body.firstNameTh).toBe("เก่า")

    expect((await GET(reqGet(admin()), ctx(9999))).status).toBe(404)
  })

  // --- PUT (edit) ---
  it("PUT returns 401 without a session", async () => {
    expect((await PUT(reqWithBody("PUT", editBody), ctx(targetId))).status).toBe(401)
  })

  it("PUT returns 403 for a non-admin", async () => {
    const stu = await createUser(db, { email: "s@kmitl.ac.th", name: "S", idCode: "9" })
    await assignRole(db, stu.id, "Student")
    const res = await PUT(reqWithBody("PUT", editBody, createSessionToken({ email: "s@kmitl.ac.th", name: "S" })), ctx(targetId))
    expect(res.status).toBe(403)
  })

  it("PUT updates personal data", async () => {
    const res = await PUT(reqWithBody("PUT", editBody, admin()), ctx(targetId))
    expect(res.status).toBe(200)
    const detail = await getUserById(db, targetId)
    expect(detail?.email).toBe("new@kmitl.ac.th")
    expect(detail?.firstNameTh).toBe("ใหม่")
    expect(detail?.idCode).toBe("64019999")
    expect(detail?.name).toBe("ใหม่ นามใหม่")
  })

  it("PUT returns 400 for invalid input", async () => {
    const res = await PUT(reqWithBody("PUT", { ...editBody, email: "bad" }, admin()), ctx(targetId))
    expect(res.status).toBe(400)
  })

  it("PUT returns 404 for an unknown id", async () => {
    expect((await PUT(reqWithBody("PUT", editBody, admin()), ctx(9999))).status).toBe(404)
  })

  it("PUT returns 409 when email belongs to another user", async () => {
    await createUser(db, { email: "taken@kmitl.ac.th", name: "T", idCode: "5" })
    const res = await PUT(reqWithBody("PUT", { ...editBody, email: "taken@kmitl.ac.th" }, admin()), ctx(targetId))
    expect(res.status).toBe(409)
  })

  it("PUT allows keeping the same email", async () => {
    const res = await PUT(reqWithBody("PUT", { ...editBody, email: "old@kmitl.ac.th" }, admin()), ctx(targetId))
    expect(res.status).toBe(200)
  })

  // --- PATCH (activate) ---
  it("PATCH toggles is_active", async () => {
    const off = await PATCH(reqWithBody("PATCH", { isActive: false }, admin()), ctx(targetId))
    expect(off.status).toBe(200)
    expect((await getUserById(db, targetId))?.isActive).toBe(false)

    await PATCH(reqWithBody("PATCH", { isActive: true }, admin()), ctx(targetId))
    expect((await getUserById(db, targetId))?.isActive).toBe(true)
  })

  it("PATCH returns 404 for an unknown id", async () => {
    expect((await PATCH(reqWithBody("PATCH", { isActive: false }, admin()), ctx(9999))).status).toBe(404)
  })

  // --- DELETE ---
  it("DELETE removes the user", async () => {
    const res = await DELETE(reqWithBody("DELETE", {}, admin()), ctx(targetId))
    expect(res.status).toBe(200)
    expect(await getUserById(db, targetId)).toBeNull()
  })

  it("DELETE returns 404 for an unknown id", async () => {
    expect((await DELETE(reqWithBody("DELETE", {}, admin()), ctx(9999))).status).toBe(404)
  })
})
