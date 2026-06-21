import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { PUT } from "./route"
import { createUser, assignRole, findUserByEmail } from "@/lib/users/repository"
import { hashPassword, verifyPassword } from "@/lib/password"
import { createSessionToken } from "@/lib/auth"
import { freshDb, setTestDb, type Queryable } from "@/lib/test-support/db"

function putReq(body: unknown, sessionToken?: string): NextRequest {
  const r = new NextRequest("http://localhost/api/profile/password", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (sessionToken) r.cookies.set("session", sessionToken)
  return r
}

describe("PUT /api/profile/password", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })

  afterEach(() => setTestDb(null))

  it("returns 401 without a session", async () => {
    expect((await PUT(putReq({ currentPassword: "x", newPassword: "y", confirmPassword: "y" }))).status).toBe(401)
  })

  it("returns 400 for Google account (no password hash)", async () => {
    const u = await createUser(db, { email: "google@kmitl.ac.th", name: "G", passwordHash: null })
    await assignRole(db, u.id, "Student")
    const session = createSessionToken({ email: "google@kmitl.ac.th", name: "G" })

    const res = await PUT(putReq({ currentPassword: "x", newPassword: "Password1", confirmPassword: "Password1" }, session))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("returns 400 with error when current password is wrong", async () => {
    const hash = await hashPassword("CorrectPass1")
    const u = await createUser(db, { email: "u@kmitl.ac.th", name: "U", passwordHash: hash })
    await assignRole(db, u.id, "Instructor")
    const session = createSessionToken({ email: "u@kmitl.ac.th", name: "U" })

    const res = await PUT(putReq({ currentPassword: "WrongPass1", newPassword: "NewPass1!", confirmPassword: "NewPass1!" }, session))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("รหัสผ่านเดิมไม่ถูกต้อง")
  })

  it("returns 400 when new password fails policy", async () => {
    const hash = await hashPassword("CorrectPass1")
    const u = await createUser(db, { email: "v@kmitl.ac.th", name: "V", passwordHash: hash })
    await assignRole(db, u.id, "Instructor")
    const session = createSessionToken({ email: "v@kmitl.ac.th", name: "V" })

    const res = await PUT(putReq({ currentPassword: "CorrectPass1", newPassword: "weak", confirmPassword: "weak" }, session))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.errors.newPassword).toBeDefined()
  })

  it("changes password and new hash verifies correctly", async () => {
    const hash = await hashPassword("OldPass1")
    const u = await createUser(db, { email: "w@kmitl.ac.th", name: "W", passwordHash: hash })
    await assignRole(db, u.id, "Instructor")
    const session = createSessionToken({ email: "w@kmitl.ac.th", name: "W" })

    const res = await PUT(putReq({ currentPassword: "OldPass1", newPassword: "NewPass1", confirmPassword: "NewPass1" }, session))
    expect(res.status).toBe(200)

    const updated = await findUserByEmail(db, "w@kmitl.ac.th")
    expect(await verifyPassword("NewPass1", updated!.passwordHash!)).toBe(true)
    expect(await verifyPassword("OldPass1", updated!.passwordHash!)).toBe(false)
  })
})
