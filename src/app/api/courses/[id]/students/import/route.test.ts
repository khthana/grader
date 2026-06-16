import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { NextRequest } from "next/server"
import { POST } from "./route"
import { setTestDb } from "@/lib/db"
import { createUser, assignRole, type Queryable } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { createSessionToken } from "@/lib/auth"

const schema = readFileSync(
  fileURLToPath(new URL("../../../../../../../schema.sql", import.meta.url)),
  "utf8"
)

function freshDb(): Queryable {
  const mem = newDb()
  mem.public.none(schema)
  const { Pool } = mem.adapters.createPg()
  return new Pool() as unknown as Queryable
}

function postReq(courseId: number, rows: unknown[], token?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/courses/${courseId}/students/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rows }),
  })
  if (token) r.cookies.set("session", token)
  return r
}

const ctx = (courseId: number) => ({ params: Promise.resolve({ id: String(courseId) }) })
const sessionFor = (email: string) => createSessionToken({ email, name: "x" })

async function seedInstructorCourse(db: Queryable) {
  const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
  await assignRole(db, ins.id, "Instructor")
  const course = await createCourse(db, {
    code: "C",
    nameTh: "ก",
    nameEn: "A",
    program: "วิศวกรรมคอมพิวเตอร์",
  })
  await assignInstructor(db, course.id, ins.id)
  return { ins, course }
}

const row = (idCode: string, extra: Record<string, string> = {}) => ({
  idCode,
  titleTh: "นาย",
  firstNameTh: "ชื่อ",
  lastNameTh: "สกุล",
  ...extra,
})

describe("POST /api/courses/[id]/students/import", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })
  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    const { course } = await seedInstructorCourse(db)
    const res = await POST(postReq(course.id, [row("65010100")]), ctx(course.id))
    expect(res.status).toBe(401)
  })

  it("returns 403 for a TA (read-only roster)", async () => {
    const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
    await assignRole(db, ta.id, "TA")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course.id, ta.id)

    const res = await POST(postReq(course.id, [row("65010100")], sessionFor("ta@kmitl.ac.th")), ctx(course.id))
    expect(res.status).toBe(403)
  })

  it("enrolls valid rows, flags bad ones, and reports per-row results + counts", async () => {
    const { course } = await seedInstructorCourse(db)

    const res = await POST(
      postReq(
        course.id,
        [
          row("65010100"),
          { idCode: "", firstNameTh: "", lastNameTh: "x" }, // invalid
          row("65010200"),
        ],
        sessionFor("ins@kmitl.ac.th")
      ),
      ctx(course.id)
    )
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.created).toBe(2)
    expect(body.failed).toBe(1)
    expect(body.results).toHaveLength(3)
    expect(body.results[0].status).toBe("created")
    expect(body.results[1].status).toBe("error")
    expect(body.results[1].errors.idCode).toBeTruthy()
    expect(body.results[2].status).toBe("created")

    // logged once
    const { rows } = await db.query<{ action: string }>(
      "SELECT action FROM user_logs WHERE action = 'enrollment.import'"
    )
    expect(rows).toHaveLength(1)
  })

  it("skips a student already enrolled in the course", async () => {
    const { course } = await seedInstructorCourse(db)
    // first import enrolls them
    await POST(postReq(course.id, [row("65010100")], sessionFor("ins@kmitl.ac.th")), ctx(course.id))

    // second import of the same id_code is skipped, not created
    const res = await POST(postReq(course.id, [row("65010100")], sessionFor("ins@kmitl.ac.th")), ctx(course.id))
    const body = await res.json()
    expect(body.created).toBe(0)
    expect(body.skipped).toBe(1)
    expect(body.results[0].status).toBe("skipped")
  })
})
