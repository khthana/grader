import { describe, it, expect, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import {
  createSubmission,
  listSubmissions,
  countSubmitted,
  countPending,
  type Queryable,
} from "./repository"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { seedWeeks, listWeeks } from "@/lib/weeks/repository"
import { createProblem } from "@/lib/problems/repository"
import { createEnrollment } from "@/lib/enrollments/repository"

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

describe("submission repository", () => {
  let db: Queryable
  let courseId: number
  let problemId: number
  let userId: number

  beforeEach(async () => {
    db = freshDb()
    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, ins.id, "Instructor")
    const student = await createUser(db, { email: "stu@kmitl.ac.th", name: "Stu", idCode: "64010001" })
    await assignRole(db, student.id, "Student")
    userId = student.id
    const course = await createCourse(db, { code: "C01", nameTh: "ก", nameEn: "A" })
    courseId = course.id
    await assignInstructor(db, courseId, ins.id)
    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)
    const problem = await createProblem(db, { courseId, weekId: weeks[0].id, title: "Q1" })
    problemId = problem.id
    await createEnrollment(db, { courseId, userId: student.id })
  })

  it("createSubmission returns a record with correct fields", async () => {
    const sub = await createSubmission(db, {
      problemId,
      userId,
      courseId,
      code: "print('hello')",
      language: "python",
      pointsEarned: 10,
      pointsMax: 10,
      isLate: false,
      results: [{ passed: true }],
    })
    expect(sub.id).toBeGreaterThan(0)
    expect(sub.problemId).toBe(problemId)
    expect(sub.userId).toBe(userId)
    expect(sub.isLate).toBe(false)
    expect(sub.pointsEarned).toBe(10)
    expect(sub.reviewedAt).toBeNull()
    expect(sub.manualScore).toBeNull()
  })

  it("countSubmitted counts distinct enrolled users who submitted ≥1 time", async () => {
    // 0 submissions → 0
    expect(await countSubmitted(db, problemId, courseId)).toBe(0)

    // student submits twice → still 1
    await createSubmission(db, { problemId, userId, courseId, code: "x", language: "python", pointsEarned: 5, pointsMax: 10, isLate: false, results: [] })
    await createSubmission(db, { problemId, userId, courseId, code: "y", language: "python", pointsEarned: 10, pointsMax: 10, isLate: false, results: [] })
    expect(await countSubmitted(db, problemId, courseId)).toBe(1)
  })

  it("countPending counts submissions where reviewed_at IS NULL", async () => {
    expect(await countPending(db, problemId)).toBe(0)
    await createSubmission(db, { problemId, userId, courseId, code: "x", language: "python", pointsEarned: 5, pointsMax: 10, isLate: false, results: [] })
    expect(await countPending(db, problemId)).toBe(1)
  })
})
