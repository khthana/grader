import { describe, it, expect, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { getStudentAssignments, type Queryable } from "./repository"
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

describe("assignments repository", () => {
  let db: Queryable
  let courseId: number
  let problemId: number
  let studentId: number
  let instructorId: number

  beforeEach(async () => {
    db = freshDb()
    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, ins.id, "Instructor")
    instructorId = ins.id

    const student = await createUser(db, { email: "stu@kmitl.ac.th", name: "Stu", idCode: "64010001" })
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

  it("returns all problems with submission null when student has not submitted", async () => {
    const items = await getStudentAssignments(db, courseId, studentId)

    expect(items).toHaveLength(1)
    expect(items[0].problemId).toBe(problemId)
    expect(items[0].title).toBe("Q1")
    expect(items[0].weekNo).toBe(1)
    expect(items[0].pointsMax).toBe(10)
    expect(items[0].submission).toBeNull()
  })

  it("returns effectiveScore = pointsEarned after submission", async () => {
    await createSubmission(db, {
      problemId, userId: studentId, courseId,
      code: "print('ok')", language: "python",
      pointsEarned: 7, pointsMax: 10, isLate: false, results: [],
    })

    const items = await getStudentAssignments(db, courseId, studentId)
    expect(items[0].submission).not.toBeNull()
    expect(items[0].submission!.pointsEarned).toBe(7)
    expect(items[0].submission!.effectiveScore).toBe(7)
    expect(items[0].submission!.isLate).toBe(false)
  })

  it("returns effectiveScore = manualScore after instructor review", async () => {
    const sub = await createSubmission(db, {
      problemId, userId: studentId, courseId,
      code: "x", language: "python",
      pointsEarned: 3, pointsMax: 10, isLate: true, results: [],
    })
    await reviewSubmission(db, sub.id, { manualScore: 8, reviewedBy: instructorId })

    const items = await getStudentAssignments(db, courseId, studentId)
    expect(items[0].submission!.manualScore).toBe(8)
    expect(items[0].submission!.effectiveScore).toBe(8)
    expect(items[0].submission!.isLate).toBe(true)
  })
})
