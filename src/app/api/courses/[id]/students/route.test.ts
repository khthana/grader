import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, POST } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { freshDb, setTestDb, sessionFor, type Queryable } from "@/lib/test-support/db"

function req(courseId: number, query = "", sessionToken?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/courses/${courseId}/students${query}`)
  if (sessionToken) r.cookies.set("session", sessionToken)
  return r
}

function postReq(courseId: number, body: unknown, sessionToken?: string): NextRequest {
  const r = new NextRequest(`http://localhost/api/courses/${courseId}/students`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (sessionToken) r.cookies.set("session", sessionToken)
  return r
}

const newStudent = {
  idCode: "65010100",
  titleTh: "นาย",
  firstNameTh: "ประพาฬพงษ์",
  lastNameTh: "ธรรมาวาดานันท์",
  studyGroup: "1",
}

async function seedInstructorCourse(db: Queryable) {
  const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
  await assignRole(db, ins.id, "Instructor")
  const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
  await assignInstructor(db, course.id, ins.id)
  return { ins, course }
}

const ctx = (courseId: number) => ({ params: Promise.resolve({ id: String(courseId) }) })

describe("GET /api/courses/[id]/students", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })

  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    const res = await GET(req(course.id), ctx(course.id))
    expect(res.status).toBe(401)
  })

  it("returns 403 for an instructor not assigned to the course", async () => {
    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, ins.id, "Instructor")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })

    const res = await GET(req(course.id, "", sessionFor("ins@kmitl.ac.th")), ctx(course.id))
    expect(res.status).toBe(403)
  })

  it("returns the paged roster for an entitled instructor", async () => {
    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, ins.id, "Instructor")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course.id, ins.id)

    const stu = await createUser(db, {
      email: "65010100@kmitl.ac.th",
      name: "นักศึกษา หนึ่ง",
      idCode: "65010100",
      titleTh: "นาย",
    })
    await createEnrollment(db, { courseId: course.id, userId: stu.id, studyGroup: "1" })

    const res = await GET(req(course.id, "", sessionFor("ins@kmitl.ac.th")), ctx(course.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(10)
    expect(body.enrollments).toHaveLength(1)
    expect(body.enrollments[0].sid).toBe("65010100")
  })

  it("includes the course's distinct groups for the filter", async () => {
    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, ins.id, "Instructor")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course.id, ins.id)
    const s1 = await createUser(db, { email: "a@kmitl.ac.th", name: "A" })
    const s2 = await createUser(db, { email: "b@kmitl.ac.th", name: "B" })
    await createEnrollment(db, { courseId: course.id, userId: s1.id, studyGroup: "2" })
    await createEnrollment(db, { courseId: course.id, userId: s2.id, studyGroup: "1" })

    const res = await GET(req(course.id, "", sessionFor("ins@kmitl.ac.th")), ctx(course.id))
    const body = await res.json()
    expect(body.groups).toEqual(["1", "2"])
  })
})

describe("POST /api/courses/[id]/students", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })

  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    const res = await POST(postReq(course.id, newStudent), ctx(course.id))
    expect(res.status).toBe(401)
  })

  it("returns 403 for a TA (read-only roster)", async () => {
    const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
    await assignRole(db, ta.id, "TA")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course.id, ta.id)

    const res = await POST(postReq(course.id, newStudent, sessionFor("ta@kmitl.ac.th")), ctx(course.id))
    expect(res.status).toBe(403)
  })

  it("returns 403 for an instructor not assigned to the course", async () => {
    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, ins.id, "Instructor")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })

    const res = await POST(postReq(course.id, newStudent, sessionFor("ins@kmitl.ac.th")), ctx(course.id))
    expect(res.status).toBe(403)
  })

  it("returns 400 when required fields are missing", async () => {
    const { course } = await seedInstructorCourse(db)
    const res = await POST(
      postReq(course.id, { idCode: "", firstNameTh: "", lastNameTh: "" }, sessionFor("ins@kmitl.ac.th")),
      ctx(course.id)
    )
    expect(res.status).toBe(400)
  })

  it("enrolls a new student (201) and logs enrollment.add", async () => {
    const { course } = await seedInstructorCourse(db)

    const res = await POST(postReq(course.id, newStudent, sessionFor("ins@kmitl.ac.th")), ctx(course.id))
    expect(res.status).toBe(201)

    const list = await GET(req(course.id, "", sessionFor("ins@kmitl.ac.th")), ctx(course.id))
    const body = await list.json()
    expect(body.total).toBe(1)
    expect(body.enrollments[0].sid).toBe("65010100")

    const { rows } = await db.query<{ action: string }>(
      "SELECT action FROM user_logs WHERE action = 'enrollment.add'"
    )
    expect(rows).toHaveLength(1)
  })

  it("returns 409 when the student is already in the course", async () => {
    const { course } = await seedInstructorCourse(db)
    await POST(postReq(course.id, newStudent, sessionFor("ins@kmitl.ac.th")), ctx(course.id))

    const dup = await POST(postReq(course.id, newStudent, sessionFor("ins@kmitl.ac.th")), ctx(course.id))
    expect(dup.status).toBe(409)
  })
})
