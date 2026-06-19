import { describe, it, expect, beforeEach } from "vitest"
import { getGradebook } from "./repository"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { seedWeeks, listWeeks } from "@/lib/weeks/repository"
import { createProblem, setTestCases } from "@/lib/problems/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { createSubmission, reviewSubmission } from "@/lib/submissions/repository"
import { freshDb, type Queryable } from "@/lib/test-support/db"
import type { CourseRecord } from "@/lib/courses/types"

describe("gradebook repository", () => {
  let db: Queryable
  let course: CourseRecord
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

    course = await createCourse(db, { code: "C01", year: 2567, semester: 1, nameTh: "ก", nameEn: "A" })
    await assignInstructor(db, course, ins.id)
    await seedWeeks(db, course)
    const weeks = await listWeeks(db, course)

    const problem = await createProblem(db, {
      courseCode: course.code, courseYear: course.year, courseSemester: course.semester,
      weekId: weeks[0].id, title: "Q1",
    })
    problemId = problem.id
    await setTestCases(db, problemId, [
      { input: "", expectedOutput: "ok", isHidden: false, score: 10, sortOrder: 0 },
    ])

    await createEnrollment(db, {
      courseCode: course.code, courseYear: course.year, courseSemester: course.semester,
      userId: studentId,
    })
  })

  function makeSub(overrides?: object) {
    return {
      problemId,
      userId: studentId,
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      code: "print('ok')",
      language: "python",
      pointsEarned: 0,
      pointsMax: 10,
      isLate: false,
      results: [] as unknown[],
      ...overrides,
    }
  }

  it("includes enrolled students with no submissions (score = null)", async () => {
    const gb = await getGradebook(db, course)

    expect(gb.problems).toHaveLength(1)
    expect(gb.problems[0].id).toBe(problemId)
    expect(gb.problems[0].pointsMax).toBe(10)

    expect(gb.students).toHaveLength(1)
    expect(gb.students[0].userId).toBe(studentId)
    expect(gb.students[0].idCode).toBe("64010001")
    expect(gb.students[0].scores[problemId]).toBeNull()
  })

  it("student with submission shows pointsEarned as effectiveScore", async () => {
    await createSubmission(db, makeSub({ pointsEarned: 7 }))

    const gb = await getGradebook(db, course)
    expect(gb.students[0].scores[problemId]).toBe(7)
  })

  it("manual score override supersedes pointsEarned", async () => {
    const s = await createSubmission(db, makeSub({ pointsEarned: 3 }))
    await reviewSubmission(db, s.id, { manualScore: 9, reviewedBy: instructorId })

    const gb = await getGradebook(db, course)
    expect(gb.students[0].scores[problemId]).toBe(9)
  })

  it("exposes each problem's dueAt and rolls a past-due unsubmitted problem up to a missing status", async () => {
    const weeks = await listWeeks(db, course)
    const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    await createProblem(db, {
      courseCode: course.code, courseYear: course.year, courseSemester: course.semester,
      weekId: weeks[0].id, title: "Q2 (overdue)", dueAt: past,
    })

    const gb = await getGradebook(db, course)

    const overdue = gb.problems.find((p) => p.title === "Q2 (overdue)")
    expect(overdue?.dueAt).toBe(past)
    expect(gb.students[0].status).toBe("missing")
  })
})
