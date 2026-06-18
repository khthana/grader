import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { freshDb, setTestDb, sessionFor, type Queryable } from "@/lib/test-support/db"

function req(query = "", sessionToken?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/users${query}`)
  if (sessionToken) r.cookies.set("session", sessionToken)
  return r
}

describe("GET /api/users", () => {
  let db: Queryable

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    const admin = await createUser(db, { email: "admin@kmitl.ac.th", name: "System Admin" })
    await assignRole(db, admin.id, "Admin")
    const student = await createUser(db, {
      email: "stu@kmitl.ac.th",
      name: "Student One",
      idCode: "64010001",
    })
    await assignRole(db, student.id, "Student")
  })

  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it("returns 403 for a signed-in non-admin", async () => {
    const res = await GET(req("", sessionFor("stu@kmitl.ac.th")))
    expect(res.status).toBe(403)
  })

  it("returns the paginated user list for an admin", async () => {
    const res = await GET(req("", sessionFor("admin@kmitl.ac.th")))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.total).toBe(2)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(10)
    expect(body.users).toHaveLength(2)
    const student = body.users.find((u: { email: string }) => u.email === "stu@kmitl.ac.th")
    expect(student.idCode).toBe("64010001")
    expect(student.roles).toEqual(["Student"])
  })

  it("applies search and pagination from query params", async () => {
    const res = await GET(req("?search=admin&page=1&pageSize=1", sessionFor("admin@kmitl.ac.th")))
    const body = await res.json()
    expect(body.pageSize).toBe(1)
    expect(body.total).toBe(1)
    expect(body.users.map((u: { email: string }) => u.email)).toEqual(["admin@kmitl.ac.th"])
  })
})
