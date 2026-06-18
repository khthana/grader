import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"
import { createUser, assignRole, findUserByEmail } from "@/lib/users/repository"
import { createSessionToken } from "@/lib/auth"
import { freshDb, setTestDb, type Queryable } from "@/lib/test-support/db"

const admin = () => createSessionToken({ email: "admin@kmitl.ac.th", name: "Admin" })

function importReq(rows: unknown, token?: string): NextRequest {
  const r = new NextRequest("http://localhost/api/users/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rows }),
  })
  if (token) r.cookies.set("session", token)
  return r
}

describe("POST /api/users/import", () => {
  let db: Queryable

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    const a = await createUser(db, { email: "admin@kmitl.ac.th", name: "Admin", idCode: "0" })
    await assignRole(db, a.id, "Admin")
  })

  afterEach(() => setTestDb(null))

  it("returns 401 without a session", async () => {
    expect((await POST(importReq([]))).status).toBe(401)
  })

  it("returns 403 for a non-admin", async () => {
    const s = await createUser(db, { email: "s@kmitl.ac.th", name: "S", idCode: "1" })
    await assignRole(db, s.id, "Student")
    expect((await POST(importReq([], createSessionToken({ email: "s@kmitl.ac.th", name: "S" })))).status).toBe(403)
  })

  it("creates valid rows and reports invalid rows per-row", async () => {
    const rows = [
      { firstNameTh: "ก", lastNameTh: "ข", email: "a@kmitl.ac.th", idCode: "1", roles: "Student" },
      { firstNameTh: "", lastNameTh: "ค", email: "bad", idCode: "" }, // invalid
      { firstNameTh: "ง", lastNameTh: "จ", email: "c@kmitl.ac.th", idCode: "3" },
    ]
    const res = await POST(importReq(rows, admin()))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.created).toBe(2)
    expect(body.failed).toBe(1)
    expect(body.results.find((r: { row: number }) => r.row === 2).status).toBe("error")
    expect(body.results.find((r: { row: number }) => r.row === 2).errors.email).toBeDefined()

    // valid rows actually persisted; invalid one did not
    expect(await findUserByEmail(db, "a@kmitl.ac.th")).not.toBeNull()
    expect(await findUserByEmail(db, "c@kmitl.ac.th")).not.toBeNull()
    const created = await findUserByEmail(db, "a@kmitl.ac.th")
    expect(created?.name).toBe("ก ข")
  })

  it("flags a row whose email already exists in the database, still creating the rest", async () => {
    await createUser(db, { email: "taken@kmitl.ac.th", name: "Taken", idCode: "9" })
    const rows = [
      { firstNameTh: "ก", lastNameTh: "ข", email: "taken@kmitl.ac.th", idCode: "1" },
      { firstNameTh: "ง", lastNameTh: "จ", email: "fresh@kmitl.ac.th", idCode: "2" },
    ]
    const res = await POST(importReq(rows, admin()))
    const body = await res.json()

    expect(body.created).toBe(1)
    expect(body.failed).toBe(1)
    expect(body.results.find((r: { row: number }) => r.row === 1).errors.email).toBeDefined()
    expect(await findUserByEmail(db, "fresh@kmitl.ac.th")).not.toBeNull()
  })
})
