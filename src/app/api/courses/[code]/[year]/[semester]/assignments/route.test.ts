import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createProblem, setTestCases } from "@/lib/problems/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { createSubmission, reviewSubmission } from "@/lib/submissions/repository"
import { listWeeks } from "@/lib/weeks/repository"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"

describe("GET /api/courses/[code]/[year]/[semester]/assignments", () => {
  let f: CourseFixture
  let studentSession: string

  function req(session?: string): NextRequest {
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/assignments`
    )
    if (session) r.cookies.set("session", session)
    return r
  }

  function ctx() {
    return {
      params: Promise.resolve({
        code: f.course.code,
        year: String(f.course.year),
        semester: String(f.course.semester),
      }),
    }
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)

    const student = await createUser(f.db, {
      email: "stu@kmitl.ac.th",
      name: "Stu",
      idCode: "64010001",
    })
    await assignRole(f.db, student.id, "Student")
    await createEnrollment(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      userId: student.id,
    })
    studentSession = sessionFor("stu@kmitl.ac.th")
  })

  afterEach(() => setTestDb(null))

  it("returns 401 when not signed in", async () => {
    const res = await GET(req(), ctx())
    expect(res.status).toBe(401)
  })

  it("returns empty assignments when the course has no problems", async () => {
    const res = await GET(req(studentSession), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assignments).toEqual([])
  })

  it("returns reviewedAt null for an unreviewed submission", async () => {
    const weeks = await listWeeks(f.db, f.course)
    const problem = await createProblem(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      weekId: weeks[0].id,
      title: "Q1",
      score: 10,
    })
    await setTestCases(f.db, problem.id, [
      { input: "", expectedOutput: "ok", isHidden: false, sortOrder: 0 },
    ])

    const student = await createUser(f.db, { email: "stu2@kmitl.ac.th", name: "S2" })
    await assignRole(f.db, student.id, "Student")
    await createEnrollment(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      userId: student.id,
    })
    await createSubmission(f.db, {
      problemId: problem.id,
      userId: student.id,
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      code: "print('ok')",
      language: "python",
      pointsEarned: 10,
      pointsMax: 10,
      isLate: false,
      results: [],
    })

    const res = await GET(req(sessionFor("stu2@kmitl.ac.th")), ctx())
    const body = await res.json()
    expect(body.assignments[0].submission.reviewedAt).toBeNull()
  })

  it("returns non-null reviewedAt after instructor review", async () => {
    const weeks = await listWeeks(f.db, f.course)
    const problem = await createProblem(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      weekId: weeks[0].id,
      title: "Q1",
      score: 10,
    })
    await setTestCases(f.db, problem.id, [
      { input: "", expectedOutput: "ok", isHidden: false, sortOrder: 0 },
    ])

    const student = await createUser(f.db, { email: "stu3@kmitl.ac.th", name: "S3" })
    await assignRole(f.db, student.id, "Student")
    await createEnrollment(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      userId: student.id,
    })
    const sub = await createSubmission(f.db, {
      problemId: problem.id,
      userId: student.id,
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      code: "print('ok')",
      language: "python",
      pointsEarned: 10,
      pointsMax: 10,
      isLate: false,
      results: [],
    })
    await reviewSubmission(f.db, sub.id, { manualScore: 10, reviewedBy: f.ins.id })

    const res = await GET(req(sessionFor("stu3@kmitl.ac.th")), ctx())
    const body = await res.json()
    expect(body.assignments[0].submission.reviewedAt).not.toBeNull()
  })
})
