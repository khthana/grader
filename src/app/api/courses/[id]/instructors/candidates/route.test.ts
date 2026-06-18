import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { freshDb, setTestDb, sessionFor, type Queryable } from "@/lib/test-support/db"

function req(courseId: number, query = "", token?: string): NextRequest {
  const r = new NextRequest(
    `http://localhost/api/courses/${courseId}/instructors/candidates${query}`
  )
  if (token) r.cookies.set("session", token)
  return r
}

const ctx = (courseId: number) => ({ params: Promise.resolve({ id: String(courseId) }) })

async function seedInstructorCourse(db: Queryable) {
  const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
  await assignRole(db, ins.id, "Instructor")
  const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
  await assignInstructor(db, course.id, ins.id)
  return { ins, course }
}

describe("GET /api/courses/[id]/instructors/candidates", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })
  afterEach(() => setTestDb(null))

  it("returns 403 for a TA (course management only)", async () => {
    const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
    await assignRole(db, ta.id, "TA")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course.id, ta.id)

    const res = await GET(req(course.id, "", sessionFor("ta@kmitl.ac.th")), ctx(course.id))
    expect(res.status).toBe(403)
  })

  it("returns Instructor/TA candidates for a manager", async () => {
    const { course } = await seedInstructorCourse(db)
    const other = await createUser(db, { email: "other@kmitl.ac.th", name: "Other Ins" })
    await assignRole(db, other.id, "Instructor")

    const res = await GET(req(course.id, "", sessionFor("ins@kmitl.ac.th")), ctx(course.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.candidates.map((c: { email: string }) => c.email).sort()).toEqual([
      "ins@kmitl.ac.th",
      "other@kmitl.ac.th",
    ])
  })
})
