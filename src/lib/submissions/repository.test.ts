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
import type { CourseRecord } from "@/lib/courses/types"

describe("submission repository", () => {
  let db: Queryable
  let course: CourseRecord
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
    course = await createCourse(db, { code: "C01", year: 2567, semester: 1, nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course, ins.id)
    await seedWeeks(db, course)
    const weeks = await listWeeks(db, course)
    const problem = await createProblem(db, {
      courseCode: course.code, courseYear: course.year, courseSemester: course.semester,
      weekId: weeks[0].id, title: "Q1",
    })
    problemId = problem.id
    await createEnrollment(db, { courseCode: course.code, courseYear: course.year, courseSemester: course.semester, userId: student.id })
  })

  function makeSub(overrides?: object) {
    return {
      problemId,
      userId,
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      code: "print('hello')",
      language: "python",
      pointsEarned: 10,
      pointsMax: 10,
      isLate: false,
      results: [] as unknown[],
      ...overrides,
    }
  }

  it("createSubmission returns a record with correct fields", async () => {
    const s = await createSubmission(db, makeSub({ results: [{ passed: true }] }))
    expect(s.id).toBeGreaterThan(0)
    expect(s.problemId).toBe(problemId)
    expect(s.userId).toBe(userId)
    expect(s.isLate).toBe(false)
    expect(s.pointsEarned).toBe(10)
    expect(s.reviewedAt).toBeNull()
    expect(s.manualScore).toBeNull()
  })

  it("countSubmitted counts distinct enrolled users who submitted ≥1 time", async () => {
    expect(await countSubmitted(db, problemId, course)).toBe(0)

    await createSubmission(db, makeSub({ code: "x", pointsEarned: 5 }))
    await createSubmission(db, makeSub({ code: "y", pointsEarned: 10 }))
    expect(await countSubmitted(db, problemId, course)).toBe(1)
  })

  it("countPending counts submissions where reviewed_at IS NULL", async () => {
    expect(await countPending(db, problemId)).toBe(0)
    await createSubmission(db, makeSub({ pointsEarned: 5 }))
    expect(await countPending(db, problemId)).toBe(1)
  })

  it("getSubmission returns full record including code and results", async () => {
    const created = await createSubmission(db, makeSub({
      code: "print('hi')", pointsEarned: 5, results: [{ passed: false, testCaseId: 1 }],
    }))
    const found = await getSubmission(db, created.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
    expect(found!.code).toBe("print('hi')")
    expect(found!.pointsEarned).toBe(5)
    expect(found!.results).toMatchObject([{ passed: false, testCaseId: 1 }])
  })

  it("getSubmission returns null for unknown id", async () => {
    expect(await getSubmission(db, 99999)).toBeNull()
  })

  it("reviewSubmission sets manual_score, reviewed_by, reviewed_at", async () => {
    const s = await createSubmission(db, makeSub({ pointsEarned: 3 }))
    const reviewed = await reviewSubmission(db, s.id, { manualScore: 8, reviewedBy: instructorId })
    expect(reviewed).not.toBeNull()
    expect(reviewed!.manualScore).toBe(8)
    expect(reviewed!.reviewedBy).toBe(instructorId)
    expect(reviewed!.reviewedAt).not.toBeNull()
  })

  it("reviewSubmission with manualScore null still sets reviewed_at", async () => {
    const s = await createSubmission(db, makeSub())
    const reviewed = await reviewSubmission(db, s.id, { manualScore: null, reviewedBy: instructorId })
    expect(reviewed!.manualScore).toBeNull()
    expect(reviewed!.reviewedAt).not.toBeNull()
  })

  it("after reviewSubmission, countPending decreases", async () => {
    const s = await createSubmission(db, makeSub({ pointsEarned: 5 }))
    expect(await countPending(db, problemId)).toBe(1)
    await reviewSubmission(db, s.id, { manualScore: 5, reviewedBy: instructorId })
    expect(await countPending(db, problemId)).toBe(0)
  })

  it("listSubmissionsForProblem includes student name and id_code", async () => {
    await createSubmission(db, makeSub({ pointsEarned: 7, isLate: true }))
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
    await createSubmission(db, makeSub({ code: "first", pointsEarned: 3 }))
    const second = await createSubmission(db, makeSub({ code: "second", pointsEarned: 7 }))
    const last = await getLastSubmission(db, problemId, userId)
    expect(last).not.toBeNull()
    expect(last!.id).toBe(second.id)
    expect(last!.code).toBe("second")
  })

  it("listPendingSubmissions returns empty when no submissions", async () => {
    expect(await listPendingSubmissions(db, course)).toHaveLength(0)
  })

  it("listPendingSubmissions returns pending items with problem and student info", async () => {
    await createSubmission(db, makeSub({ pointsEarned: 5 }))

    const list = await listPendingSubmissions(db, course)
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
    const s = await createSubmission(db, makeSub({ pointsEarned: 5 }))
    expect(await listPendingSubmissions(db, course)).toHaveLength(1)

    await reviewSubmission(db, s.id, { manualScore: null, reviewedBy: instructorId })
    expect(await listPendingSubmissions(db, course)).toHaveLength(0)
  })

  // keep listSubmissions imported to avoid unused-import warning
  it("listSubmissions returns all submissions for a problem", async () => {
    await createSubmission(db, makeSub({ pointsEarned: 3 }))
    await createSubmission(db, makeSub({ pointsEarned: 7 }))
    const list = await listSubmissions(db, problemId)
    expect(list).toHaveLength(2)
  })
})
