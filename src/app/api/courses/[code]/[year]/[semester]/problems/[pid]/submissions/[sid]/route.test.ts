import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { PUT } from "./route"
import { POST as createProblemRoute } from "../../../route"
import { createSubmission } from "@/lib/submissions/repository"
import { listWeeks } from "@/lib/weeks/repository"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"

describe("PUT …/problems/[pid]/submissions/[sid] — manual score cap (#66)", () => {
  let f: CourseFixture
  let problemId: number
  let submissionId: number

  const courseParams = () => ({
    code: f.course.code,
    year: String(f.course.year),
    semester: String(f.course.semester),
  })

  function put(manualScore: number): Promise<Response> {
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/problems/${problemId}/submissions/${submissionId}`,
      { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ manualScore }) }
    )
    r.cookies.set("session", sessionFor(f.ins.email))
    return PUT(r, {
      params: Promise.resolve({ ...courseParams(), pid: String(problemId), sid: String(submissionId) }),
    })
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    const weekId = (await listWeeks(f.db, f.course))[0].id

    // Created through the real route so problems.score is the derived max (5 + 25).
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/problems`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Sum",
          weekId,
          score: 10,
          testCases: [
            { input: "1", expectedOutput: "1", isHidden: false, score: 5, sortOrder: 0 },
            { input: "2", expectedOutput: "2", isHidden: true, score: 25, sortOrder: 1 },
          ],
        }),
      }
    )
    r.cookies.set("session", sessionFor(f.ins.email))
    problemId = (await (await createProblemRoute(r, { params: Promise.resolve(courseParams()) })).json()).problem.id

    submissionId = (
      await createSubmission(f.db, {
        problemId,
        userId: f.ta.id,
        courseCode: f.course.code,
        courseYear: f.course.year,
        courseSemester: f.course.semester,
        code: "print(1)",
        language: "python",
        pointsEarned: 5,
        pointsMax: 30,
        isLate: false,
        results: [],
      })
    ).id
  })

  afterEach(() => setTestDb(null))

  it("accepts a manual score up to the grading max (auto + full bonus)", async () => {
    const res = await put(30)
    expect(res.status).toBe(200)
    expect((await res.json()).submission.manualScore).toBe(30)
  })

  it("rejects a manual score above the grading max (400)", async () => {
    expect((await put(31)).status).toBe(400)
  })
})
