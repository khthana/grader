import { describe, it, expect, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { getGradebook, type Queryable } from "./repository"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { seedWeeks, listWeeks } from "@/lib/weeks/repository"
import { createProblem, setTestCases } from "@/lib/problems/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { createSubmission, reviewSubmission } from "@/lib/submissions/repository"

const schema = readFileSync(
  fileURLToPath(new URL("../../../schema.sql", import.meta.url)),
  "utf8"
)

function freshDb(): Queryable {
  const mem = newDb()
  mem.public.none(schema)
  const { Pool } = mem.adapters.createPg()
  return new Pool() as unknown as Queryable
}

describe("gradebook repository", () => {
  let db: Queryable
  let courseId: number
  let problemId: number
  let studentId: number
  let instructorId: number

  beforeEach(async () => {
    db = freshDb()
    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Instructor" })
    await assignRole(db, ins.id, "Instructor")
    instructorId = ins.id

    const student = await createUser(db, {
      email: "stu@kmitl.ac.th", name: "นักศึกษา ทดสอบ", idCode: "64010001",
    })
    await assignRole(db, student.id, "Student")
    studentId = student.id

    const course = await createCourse(db, { code: "C01", nameTh: "ก", nameEn: "A" })
    courseId = course.id
    await assignInstructor(db, courseId, ins.id)
    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)

    const problem = await createProblem(db, { courseId, weekId: weeks[0].id, title: "Q1" })
    problemId = problem.id
    await setTestCases(db, problemId, [
      { input: "", expectedOutput: "ok", isHidden: false, score: 10, sortOrder: 0 },
    ])

    await createEnrollment(db, { courseId, userId: studentId })
  })

  it("includes enrolled students with no submissions (score = null)", async () => {
    const gb = await getGradebook(db, courseId)

    expect(gb.problems).toHaveLength(1)
    expect(gb.problems[0].id).toBe(problemId)
    expect(gb.problems[0].pointsMax).toBe(10)

    expect(gb.students).toHaveLength(1)
    expect(gb.students[0].userId).toBe(studentId)
    expect(gb.students[0].idCode).toBe("64010001")
    expect(gb.students[0].scores[problemId]).toBeNull()
  })

  it("student with submission shows pointsEarned as effectiveScore", async () => {
    await createSubmission(db, {
      problemId, userId: studentId, courseId,
      code: "print('ok')", language: "python",
      pointsEarned: 7, pointsMax: 10, isLate: false, results: [],
    })

    const gb = await getGradebook(db, courseId)
    expect(gb.students[0].scores[problemId]).toBe(7)
  })

  it("manual score override supersedes pointsEarned", async () => {
    const sub = await createSubmission(db, {
      problemId, userId: studentId, courseId,
      code: "x", language: "python",
      pointsEarned: 3, pointsMax: 10, isLate: false, results: [],
    })
    await reviewSubmission(db, sub.id, { manualScore: 9, reviewedBy: instructorId })

    const gb = await getGradebook(db, courseId)
    expect(gb.students[0].scores[problemId]).toBe(9)
  })

  it("exposes each problem's dueAt and rolls a past-due unsubmitted problem up to a missing status", async () => {
    const weeks = await listWeeks(db, courseId)
    const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    await createProblem(db, {
      courseId, weekId: weeks[0].id, title: "Q2 (overdue)", dueAt: past,
    })

    const gb = await getGradebook(db, courseId)

    const overdue = gb.problems.find((p) => p.title === "Q2 (overdue)")
    expect(overdue?.dueAt).toBe(past)
    expect(gb.students[0].status).toBe("missing")
  })
})
