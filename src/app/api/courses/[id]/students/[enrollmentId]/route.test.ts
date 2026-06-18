import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { PUT, DELETE } from "./route"
import {
  createUser,
  assignRole,
  getUserById,
} from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { createEnrollment, getEnrollmentById } from "@/lib/enrollments/repository"
import { freshDb, setTestDb, sessionFor, type Queryable } from "@/lib/test-support/db"

function putReq(courseId: number, enrollmentId: number, body: unknown, token?: string): NextRequest {
  const r = new NextRequest(
    `http://localhost/api/courses/${courseId}/students/${enrollmentId}`,
    { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
  )
  if (token) r.cookies.set("session", token)
  return r
}

function delReq(courseId: number, enrollmentId: number, token?: string): NextRequest {
  const r = new NextRequest(
    `http://localhost/api/courses/${courseId}/students/${enrollmentId}`,
    { method: "DELETE" }
  )
  if (token) r.cookies.set("session", token)
  return r
}

const ctx = (courseId: number, enrollmentId: number) => ({
  params: Promise.resolve({ id: String(courseId), enrollmentId: String(enrollmentId) }),
})

async function seedInstructorCourse(db: Queryable, code = "C") {
  const ins = await createUser(db, { email: `ins-${code}@kmitl.ac.th`, name: "Ins" })
  await assignRole(db, ins.id, "Instructor")
  const course = await createCourse(db, { code, nameTh: "ก", nameEn: "A" })
  await assignInstructor(db, course.id, ins.id)
  return { ins, course, email: `ins-${code}@kmitl.ac.th` }
}

async function seedStudentEnrollment(db: Queryable, courseId: number) {
  const stu = await createUser(db, {
    email: "65010100@kmitl.ac.th",
    name: "ชื่อเดิม นามเดิม",
    idCode: "65010100",
    titleTh: "นาย",
    firstNameTh: "ชื่อเดิม",
    lastNameTh: "นามเดิม",
  })
  await assignRole(db, stu.id, "Student")
  const e = await createEnrollment(db, { courseId, userId: stu.id, studyGroup: "1" })
  return { stu, enrollment: e }
}

describe("PUT /api/courses/[id]/students/[enrollmentId]", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })
  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    const { course } = await seedInstructorCourse(db)
    const { enrollment } = await seedStudentEnrollment(db, course.id)
    const res = await PUT(putReq(course.id, enrollment.id, {}), ctx(course.id, enrollment.id))
    expect(res.status).toBe(401)
  })

  it("returns 403 for a TA (read-only roster)", async () => {
    const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
    await assignRole(db, ta.id, "TA")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course.id, ta.id)
    const { enrollment } = await seedStudentEnrollment(db, course.id)

    const res = await PUT(
      putReq(course.id, enrollment.id, { firstNameTh: "x", lastNameTh: "y" }, sessionFor("ta@kmitl.ac.th")),
      ctx(course.id, enrollment.id)
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when the enrollment is not in this course", async () => {
    const a = await seedInstructorCourse(db, "AAA")
    const b = await seedInstructorCourse(db, "BBB")
    const { enrollment } = await seedStudentEnrollment(db, b.course.id)

    // instructor of course A tries to edit an enrollment that lives in course B
    const res = await PUT(
      putReq(a.course.id, enrollment.id, { firstNameTh: "x", lastNameTh: "y" }, sessionFor(a.email)),
      ctx(a.course.id, enrollment.id)
    )
    expect(res.status).toBe(404)
  })

  it("updates enrollment + propagates name, ignores id_code, logs enrollment.update", async () => {
    const { course, email } = await seedInstructorCourse(db)
    const { stu, enrollment } = await seedStudentEnrollment(db, course.id)

    const res = await PUT(
      putReq(
        course.id,
        enrollment.id,
        {
          titleTh: "นางสาว",
          firstNameTh: "ชื่อใหม่",
          lastNameTh: "นามใหม่",
          studyGroup: "2",
          program: "วิศวกรรมไฟฟ้า",
          year: "2566",
          idCode: "99999999", // must be ignored
        },
        sessionFor(email)
      ),
      ctx(course.id, enrollment.id)
    )
    expect(res.status).toBe(200)

    const e = await getEnrollmentById(db, enrollment.id)
    expect(e?.studyGroup).toBe("2")
    expect(e?.program).toBe("วิศวกรรมไฟฟ้า")
    expect(e?.year).toBe("2566")

    const detail = await getUserById(db, stu.id)
    expect(detail?.name).toBe("ชื่อใหม่ นามใหม่")
    expect(detail?.titleTh).toBe("นางสาว")
    expect(detail?.idCode).toBe("65010100") // unchanged

    const { rows } = await db.query<{ action: string }>(
      "SELECT action FROM user_logs WHERE action = 'enrollment.update'"
    )
    expect(rows).toHaveLength(1)
  })
})

describe("DELETE /api/courses/[id]/students/[enrollmentId]", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
    setTestDb(db)
  })
  afterEach(() => setTestDb(null))

  it("returns 403 for a TA (read-only roster)", async () => {
    const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
    await assignRole(db, ta.id, "TA")
    const course = await createCourse(db, { code: "C", nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course.id, ta.id)
    const { enrollment } = await seedStudentEnrollment(db, course.id)

    const res = await DELETE(
      delReq(course.id, enrollment.id, sessionFor("ta@kmitl.ac.th")),
      ctx(course.id, enrollment.id)
    )
    expect(res.status).toBe(403)
  })

  it("un-enrolls but keeps the user and their other-course enrollment, logs enrollment.remove", async () => {
    const a = await seedInstructorCourse(db, "AAA")
    const b = await seedInstructorCourse(db, "BBB")
    const { stu, enrollment: enrollA } = await seedStudentEnrollment(db, a.course.id)
    const enrollB = await createEnrollment(db, { courseId: b.course.id, userId: stu.id })

    const res = await DELETE(
      delReq(a.course.id, enrollA.id, sessionFor(a.email)),
      ctx(a.course.id, enrollA.id)
    )
    expect(res.status).toBe(200)

    // enrollment in A is gone…
    expect(await getEnrollmentById(db, enrollA.id)).toBeNull()
    // …but the user survives and stays enrolled in B
    expect(await getUserById(db, stu.id)).not.toBeNull()
    expect(await getEnrollmentById(db, enrollB.id)).not.toBeNull()

    const { rows } = await db.query<{ action: string }>(
      "SELECT action FROM user_logs WHERE action = 'enrollment.remove'"
    )
    expect(rows).toHaveLength(1)
  })
})
