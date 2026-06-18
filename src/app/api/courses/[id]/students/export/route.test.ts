import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { freshDb, setTestDb, sessionFor, type Queryable } from "@/lib/test-support/db"

function req(courseId: number, query = "", token?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/courses/${courseId}/students/export${query}`)
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

describe("GET /api/courses/[id]/students/export", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })
  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    const { course } = await seedInstructorCourse(db)
    const res = await GET(req(course.id), ctx(course.id))
    expect(res.status).toBe(401)
  })

  it("returns 403 for a TA (read-only roster)", async () => {
    const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
    await assignRole(db, ta.id, "TA")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course.id, ta.id)

    const res = await GET(req(course.id, "", sessionFor("ta@kmitl.ac.th")), ctx(course.id))
    expect(res.status).toBe(403)
  })

  it("returns every matching row, respecting the group filter", async () => {
    const { course } = await seedInstructorCourse(db)
    for (let i = 0; i < 12; i++) {
      const s = await createUser(db, { email: `s${i}@kmitl.ac.th`, name: `S ${i}`, idCode: `id${i}` })
      await createEnrollment(db, { courseId: course.id, userId: s.id, studyGroup: i % 2 === 0 ? "1" : "2" })
    }

    const all = await GET(req(course.id, "", sessionFor("ins@kmitl.ac.th")), ctx(course.id))
    const allBody = await all.json()
    expect(allBody.enrollments).toHaveLength(12)

    const g1 = await GET(req(course.id, "?group=1", sessionFor("ins@kmitl.ac.th")), ctx(course.id))
    const g1Body = await g1.json()
    expect(g1Body.enrollments).toHaveLength(6)
    expect(g1Body.enrollments.every((e: { studyGroup: string }) => e.studyGroup === "1")).toBe(true)
  })
})
