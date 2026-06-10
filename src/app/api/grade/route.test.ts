import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { NextRequest } from "next/server"
import { POST } from "./route"
import { setTestDb } from "@/lib/db"
import { createUser, type Queryable } from "@/lib/users/repository"
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

function gradeReq(body: unknown, token?: string): NextRequest {
  const r = new NextRequest("http://localhost/api/grade", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (token) r.cookies.set("session", token)
  return r
}

describe("POST /api/grade", () => {
  let db: Queryable

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    await createUser(db, { email: "member@kmitl.ac.th", name: "Member", idCode: "1" })
  })

  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    const res = await POST(gradeReq({ problemId: "hello-world", code: "print('x')" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 for a signed-in user with missing fields (no grading attempted)", async () => {
    const token = createSessionToken({ email: "member@kmitl.ac.th", name: "Member" })
    const res = await POST(gradeReq({ problemId: "hello-world" }, token))
    expect(res.status).toBe(400)
  })
})
