import { describe, it, expect, beforeEach } from "vitest"
import { getStudentAssignments } from "./repository"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { seedWeeks, listWeeks } from "@/lib/weeks/repository"
import { createProblem, setTestCases } from "@/lib/problems/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { createSubmission, reviewSubmission } from "@/lib/submissions/repository"
import { freshDb, type Queryable } from "@/lib/test-support/db"
import type { CourseRecord } from "@/lib/courses/types"

describe("assignments repository", () => {
  let db: Queryable
  let course: CourseRecord
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

    course = await createCourse(db, { code: "C01", year: 2567, semester: 1, nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course, ins.id)
    await seedWeeks(db, course)
    const weeks = await listWeeks(db, course)

    const problem = await createProblem(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      weekId: weeks[0].id,
      title: "Q1",
      score: 10,
    })
    problemId = problem.id
    await setTestCases(db, problemId, [
      { input: "", expectedOutput: "ok", isHidden: false, sortOrder: 0 },
    ])
    await createEnrollment(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      userId: studentId,
    })
  })

  it("returns all problems with submission null when student has not submitted", async () => {
    const items = await getStudentAssignments(db, course, studentId)

    expect(items).toHaveLength(1)
    expect(items[0].problemId).toBe(problemId)
    expect(items[0].title).toBe("Q1")
    expect(items[0].weekNo).toBe(1)
    expect(items[0].pointsMax).toBe(10)
    expect(items[0].submission).toBeNull()
  })

  it("returns effectiveScore = pointsEarned after submission", async () => {
    await createSubmission(db, {
      problemId,
      userId: studentId,
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      code: "print('ok')",
      language: "python",
      pointsEarned: 7,
      pointsMax: 10,
      isLate: false,
      results: [],
    })

    const items = await getStudentAssignments(db, course, studentId)
    expect(items[0].submission).not.toBeNull()
    expect(items[0].submission!.pointsEarned).toBe(7)
    expect(items[0].submission!.effectiveScore).toBe(7)
    expect(items[0].submission!.isLate).toBe(false)
  })

  it("returns effectiveScore = manualScore after instructor review", async () => {
    const sub = await createSubmission(db, {
      problemId,
      userId: studentId,
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      code: "x",
      language: "python",
      pointsEarned: 3,
      pointsMax: 10,
      isLate: true,
      results: [],
    })
    await reviewSubmission(db, sub.id, { manualScore: 8, reviewedBy: instructorId })

    const items = await getStudentAssignments(db, course, studentId)
    expect(items[0].submission!.manualScore).toBe(8)
    expect(items[0].submission!.effectiveScore).toBe(8)
    expect(items[0].submission!.isLate).toBe(true)
  })
})
