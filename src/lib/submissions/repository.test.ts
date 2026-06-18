import { describe, it, expect, beforeEach } from "vitest"
import {
  createSubmission,
  listSubmissions,
  countSubmitted,
  countPending,
  getSubmission,
  reviewSubmission,
  listSubmissionsForProblem,
  getLastSubmission,
  listPendingSubmissions,
} from "./repository"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { seedWeeks, listWeeks } from "@/lib/weeks/repository"
import { createProblem } from "@/lib/problems/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { freshDb, type Queryable } from "@/lib/test-support/db"

describe("submission repository", () => {
  let db: Queryable
  let courseId: number
  let problemId: number
  let userId: number
  let instructorId: number

  beforeEach(async () => {
    db = freshDb()
    const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Instructor One", firstNameTh: "หนึ่ง", lastNameTh: "ผู้สอน" })
    await assignRole(db, ins.id, "Instructor")
    instructorId = ins.id
    const student = await createUser(db, { email: "stu@kmitl.ac.th", name: "Stu", idCode: "64010001", firstNameTh: "นักศึกษา", lastNameTh: "ทดสอบ" })
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

  // Phase 1 — #21 behaviors

  it("getSubmission returns full record including code and results", async () => {
    const created = await createSubmission(db, {
      problemId, userId, courseId,
      code: "print('hi')", language: "python",
      pointsEarned: 5, pointsMax: 10, isLate: false,
      results: [{ passed: false, testCaseId: 1 }],
    })
    const found = await getSubmission(db, created.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
    expect(found!.code).toBe("print('hi')")
    expect(found!.pointsEarned).toBe(5)
    expect(found!.results).toMatchObject([{ passed: false, testCaseId: 1 }])
  })

  it("getSubmission returns null for unknown id", async () => {
    const found = await getSubmission(db, 99999)
    expect(found).toBeNull()
  })

  it("reviewSubmission sets manual_score, reviewed_by, reviewed_at", async () => {
    const sub = await createSubmission(db, {
      problemId, userId, courseId,
      code: "x", language: "python",
      pointsEarned: 3, pointsMax: 10, isLate: false, results: [],
    })
    const reviewed = await reviewSubmission(db, sub.id, { manualScore: 8, reviewedBy: instructorId })
    expect(reviewed).not.toBeNull()
    expect(reviewed!.manualScore).toBe(8)
    expect(reviewed!.reviewedBy).toBe(instructorId)
    expect(reviewed!.reviewedAt).not.toBeNull()
  })

  it("reviewSubmission with manualScore null still sets reviewed_at", async () => {
    const sub = await createSubmission(db, {
      problemId, userId, courseId,
      code: "x", language: "python",
      pointsEarned: 10, pointsMax: 10, isLate: false, results: [],
    })
    const reviewed = await reviewSubmission(db, sub.id, { manualScore: null, reviewedBy: instructorId })
    expect(reviewed!.manualScore).toBeNull()
    expect(reviewed!.reviewedAt).not.toBeNull()
  })

  it("after reviewSubmission, countPending decreases", async () => {
    const sub = await createSubmission(db, {
      problemId, userId, courseId,
      code: "x", language: "python",
      pointsEarned: 5, pointsMax: 10, isLate: false, results: [],
    })
    expect(await countPending(db, problemId)).toBe(1)
    await reviewSubmission(db, sub.id, { manualScore: 5, reviewedBy: instructorId })
    expect(await countPending(db, problemId)).toBe(0)
  })

  it("listSubmissionsForProblem includes student name and id_code", async () => {
    await createSubmission(db, {
      problemId, userId, courseId,
      code: "x", language: "python",
      pointsEarned: 7, pointsMax: 10, isLate: true, results: [],
    })
    const list = await listSubmissionsForProblem(db, problemId)
    expect(list).toHaveLength(1)
    expect(list[0].userId).toBe(userId)
    expect(list[0].studentIdCode).toBe("64010001")
    expect(typeof list[0].studentName).toBe("string")
    expect(list[0].isLate).toBe(true)
    expect(list[0].pointsEarned).toBe(7)
    expect(list[0].effectiveScore).toBe(7)
  })

  it("getLastSubmission returns the most recent submission for a user+problem", async () => {
    await createSubmission(db, {
      problemId, userId, courseId,
      code: "first", language: "python",
      pointsEarned: 3, pointsMax: 10, isLate: false, results: [],
    })
    const second = await createSubmission(db, {
      problemId, userId, courseId,
      code: "second", language: "python",
      pointsEarned: 7, pointsMax: 10, isLate: false, results: [],
    })
    const last = await getLastSubmission(db, problemId, userId)
    expect(last).not.toBeNull()
    expect(last!.id).toBe(second.id)
    expect(last!.code).toBe("second")
  })

  // Phase 1 — #24 behaviors

  it("listPendingSubmissions returns empty when no submissions", async () => {
    const list = await listPendingSubmissions(db, courseId)
    expect(list).toHaveLength(0)
  })

  it("listPendingSubmissions returns pending items with problem and student info", async () => {
    await createSubmission(db, {
      problemId, userId, courseId,
      code: "x", language: "python",
      pointsEarned: 5, pointsMax: 10, isLate: false, results: [],
    })

    const list = await listPendingSubmissions(db, courseId)
    expect(list).toHaveLength(1)
    expect(list[0].problemId).toBe(problemId)
    expect(list[0].problemTitle).toBe("Q1")
    expect(list[0].weekNo).toBe(1)
    expect(list[0].userId).toBe(userId)
    expect(list[0].studentIdCode).toBe("64010001")
    expect(list[0].pointsEarned).toBe(5)
    expect(list[0].pointsMax).toBe(10)
  })

  it("after reviewSubmission, item no longer appears in pending list", async () => {
    const sub = await createSubmission(db, {
      problemId, userId, courseId,
      code: "x", language: "python",
      pointsEarned: 5, pointsMax: 10, isLate: false, results: [],
    })
    expect(await listPendingSubmissions(db, courseId)).toHaveLength(1)

    await reviewSubmission(db, sub.id, { manualScore: null, reviewedBy: instructorId })
    expect(await listPendingSubmissions(db, courseId)).toHaveLength(0)
  })
})
