// #70 — course reads that expose other students' data must not be reachable
// by an enrolled Student. One authorization matrix across the affected routes.
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET as listSubmissions } from "./problems/[pid]/submissions/route"
import { GET as getSubmission } from "./problems/[pid]/submissions/[sid]/route"
import { GET as listStudents } from "./students/route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { createProblem } from "@/lib/problems/repository"
import { createSubmission } from "@/lib/submissions/repository"
import { listWeeks } from "@/lib/weeks/repository"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"

describe("staff-only course reads (#70)", () => {
  let f: CourseFixture
  let problemId: number
  let submissionId: number
  const studentEmail = "stu@kmitl.ac.th"

  const base = () => `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}`
  const courseParams = () => ({
    code: f.course.code,
    year: String(f.course.year),
    semester: String(f.course.semester),
  })

  function get(url: string, email: string): NextRequest {
    const r = new NextRequest(url)
    r.cookies.set("session", sessionFor(email))
    return r
  }

  const calls = {
    "submissions list": (email: string) =>
      listSubmissions(get(`${base()}/problems/${problemId}/submissions`, email), {
        params: Promise.resolve({ ...courseParams(), pid: String(problemId) }),
      }),
    "submission detail": (email: string) =>
      getSubmission(get(`${base()}/problems/${problemId}/submissions/${submissionId}`, email), {
        params: Promise.resolve({ ...courseParams(), pid: String(problemId), sid: String(submissionId) }),
      }),
    roster: (email: string) =>
      listStudents(get(`${base()}/students`, email), { params: Promise.resolve(courseParams()) }),
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    const enroll = async (email: string) => {
      const u = await createUser(f.db, { email, name: email })
      await assignRole(f.db, u.id, "Student")
      await createEnrollment(f.db, {
        courseCode: f.course.code,
        courseYear: f.course.year,
        courseSemester: f.course.semester,
        userId: u.id,
      })
      return u
    }
    await enroll(studentEmail)
    const classmate = await enroll("classmate@kmitl.ac.th")
    const weekId = (await listWeeks(f.db, f.course))[0].id
    problemId = (
      await createProblem(f.db, {
        courseCode: f.course.code,
        courseYear: f.course.year,
        courseSemester: f.course.semester,
        weekId,
        title: "P",
      })
    ).id
    // A classmate's submission — the student must not be able to read its code.
    submissionId = (
      await createSubmission(f.db, {
        problemId,
        userId: classmate.id,
        courseCode: f.course.code,
        courseYear: f.course.year,
        courseSemester: f.course.semester,
        code: "secret = 42",
        language: "python",
        pointsEarned: 0,
        pointsMax: 10,
        isLate: false,
        results: [],
      })
    ).id
  })

  afterEach(() => setTestDb(null))

  for (const [name, call] of Object.entries(calls)) {
    it(`${name}: enrolled Student gets 403`, async () => {
      expect((await call(studentEmail)).status).toBe(403)
    })

    it(`${name}: Instructor gets 200`, async () => {
      expect((await call("ins@kmitl.ac.th")).status).toBe(200)
    })
  }

  it("roster: TA keeps read-only access (200)", async () => {
    expect((await calls.roster("ta@kmitl.ac.th")).status).toBe(200)
  })

  it("submissions: TA is refused like the review pages (ADR 0005 — Admin/Instructor only)", async () => {
    expect((await calls["submissions list"]("ta@kmitl.ac.th")).status).toBe(403)
    expect((await calls["submission detail"]("ta@kmitl.ac.th")).status).toBe(403)
  })
})
