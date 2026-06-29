import { describe, it, expect } from "vitest"
import { courseFixture } from "@/lib/test-support/db"
import { createCourse, getCourseByKey, listCourseInstructors, assignInstructor } from "@/lib/courses/repository"
import {
  createProblem,
  getProblemById,
  listProblems,
  getReferenceSolution,
  setTestCases,
} from "@/lib/problems/repository"
import { createSubmission, listSubmissionsForProblem } from "@/lib/submissions/repository"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment, findEnrollment } from "@/lib/enrollments/repository"
import {
  listWeeks,
  getWeekByNo,
  updateWeekTopic,
  setWeekReleased,
  addWeek,
} from "@/lib/weeks/repository"
import { duplicateCourseOffering } from "./duplicate"

describe("duplicateCourseOffering", () => {
  it("creates the target offering copying name and program from the source", async () => {
    const { db, course, ins } = await courseFixture()

    const result = await duplicateCourseOffering(
      db,
      course,
      { year: course.year, semester: 2 },
      ins.id
    )

    expect(result.ok).toBe(true)
    const target = await getCourseByKey(db, {
      code: course.code,
      year: course.year,
      semester: 2,
    })
    expect(target).not.toBeNull()
    expect(target?.nameTh).toBe(course.nameTh)
    expect(target?.nameEn).toBe(course.nameEn)
    expect(target?.program).toBe(course.program)
  })

  it("copies the source course language to the target", async () => {
    const { db, course, ins } = await courseFixture()
    await createCourse(db, {
      code: "CLANG",
      year: 2567,
      semester: 1,
      nameTh: "ซี",
      nameEn: "C course",
      language: "c",
    })
    const cKey = { code: "CLANG", year: 2567, semester: 1 }
    await assignInstructor(db, cKey, ins.id)

    await duplicateCourseOffering(db, cKey, { year: 2567, semester: 2 }, ins.id)

    const target = await getCourseByKey(db, { code: "CLANG", year: 2567, semester: 2 })
    expect(target?.language).toBe("c")
    void course
  })

  it("copies the source instructors and always includes the acting user", async () => {
    const { db, course, ins, ta } = await courseFixture()
    const admin = await createUser(db, { email: "admin@kmitl.ac.th", name: "Admin" })
    await assignRole(db, admin.id, "Admin")

    await duplicateCourseOffering(db, course, { year: course.year, semester: 2 }, admin.id)

    const staff = await listCourseInstructors(db, {
      code: course.code,
      year: course.year,
      semester: 2,
    })
    const ids = staff.map((s) => s.id).sort((a, b) => a - b)
    expect(ids).toEqual([ins.id, ta.id, admin.id].sort((a, b) => a - b))
  })

  it("mirrors every week's number and topic, resetting release state to hidden", async () => {
    const { db, course, ins } = await courseFixture()
    // Give week 1 a topic and mark it released; add a 7th week beyond the default 6.
    const week1 = await getWeekByNo(db, course, 1)
    await updateWeekTopic(db, week1!.id, "Intro")
    await setWeekReleased(db, week1!.id, true)
    await addWeek(db, course)

    const target = { code: course.code, year: course.year, semester: 2 }
    await duplicateCourseOffering(db, course, { year: course.year, semester: 2 }, ins.id)

    const weeks = await listWeeks(db, target)
    expect(weeks.map((w) => w.weekNo)).toEqual([1, 2, 3, 4, 5, 6, 7])
    const targetWeek1 = weeks.find((w) => w.weekNo === 1)
    expect(targetWeek1?.topic).toBe("Intro")
    expect(weeks.every((w) => w.isReleased === false)).toBe(true)
  })

  it("refuses and writes nothing when the target offering already exists", async () => {
    const { db, course, ins } = await courseFixture()
    await createCourse(db, {
      code: course.code,
      year: course.year,
      semester: 2,
      nameTh: "ของเดิม",
      nameEn: "Existing",
    })

    const result = await duplicateCourseOffering(db, course, { year: course.year, semester: 2 }, ins.id)

    expect(result).toEqual({ ok: false, reason: "target-exists" })
    // The pre-existing offering is untouched: name not overwritten, no weeks added.
    const target = { code: course.code, year: course.year, semester: 2 }
    expect((await getCourseByKey(db, target))?.nameTh).toBe("ของเดิม")
    expect(await listWeeks(db, target)).toHaveLength(0)
    expect(await listCourseInstructors(db, target)).toHaveLength(0)
  })

  it("does not copy student enrollments to the target offering", async () => {
    const { db, course, ins } = await courseFixture()
    const student = await createUser(db, { email: "stu@kmitl.ac.th", name: "Stu" })
    await assignRole(db, student.id, "Student")
    await createEnrollment(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      userId: student.id,
    })

    await duplicateCourseOffering(db, course, { year: course.year, semester: 2 }, ins.id)

    const target = { code: course.code, year: course.year, semester: 2 }
    expect(await findEnrollment(db, target, student.id)).toBeNull()
  })

  it("recreates each problem in the matching target week, preserving problem_no", async () => {
    const { db, course, ins } = await courseFixture()
    const week1 = await getWeekByNo(db, course, 1)
    await createProblem(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      weekId: week1!.id,
      title: "Sum two numbers",
      description: "Add a and b",
      inputSpec: "two ints",
      outputSpec: "their sum",
      score: 25,
      language: "python",
    })

    await duplicateCourseOffering(db, course, { year: course.year, semester: 2 }, ins.id)

    const target = { code: course.code, year: course.year, semester: 2 }
    const problems = await listProblems(db, target)
    expect(problems).toHaveLength(1)
    expect(problems[0].weekNo).toBe(1)
    expect(problems[0].problemNo).toBe(1)
    expect(problems[0].title).toBe("Sum two numbers")
    expect(problems[0].score).toBe(25)

    const detail = await getProblemById(db, problems[0].id)
    expect(detail?.inputSpec).toBe("two ints")
    expect(detail?.outputSpec).toBe("their sum")
    expect(detail?.language).toBe("python")
  })

  it("copies each problem's reference solution to the target", async () => {
    const { db, course, ins } = await courseFixture()
    const week1 = await getWeekByNo(db, course, 1)
    await createProblem(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      weekId: week1!.id,
      title: "P",
      referenceSolution: "print(a + b)",
    })

    await duplicateCourseOffering(db, course, { year: course.year, semester: 2 }, ins.id)

    const target = { code: course.code, year: course.year, semester: 2 }
    const [copied] = await listProblems(db, target)
    expect(await getReferenceSolution(db, copied.id)).toBe("print(a + b)")
  })

  it("clears deadlines on copied problems even when the source set them", async () => {
    const { db, course, ins } = await courseFixture()
    const week1 = await getWeekByNo(db, course, 1)
    await createProblem(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      weekId: week1!.id,
      title: "With deadlines",
      dueAt: "2025-01-01T00:00:00.000Z",
      closeAt: "2025-01-08T00:00:00.000Z",
    })

    await duplicateCourseOffering(db, course, { year: course.year, semester: 2 }, ins.id)

    const target = { code: course.code, year: course.year, semester: 2 }
    const [copied] = await listProblems(db, target)
    expect(copied.dueAt).toBeNull()
    expect(copied.closeAt).toBeNull()
  })

  it("copies unit-test-mode fields and code policy lists", async () => {
    const { db, course, ins } = await courseFixture()
    const week1 = await getWeekByNo(db, course, 1)
    await createProblem(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      weekId: week1!.id,
      title: "Unit problem",
      problemType: "unit",
      functionName: "add",
      starterCode: "def add(a, b):",
      unitTestCode: "assert add(1, 2) == 3",
      blacklist: ["eval", "exec"],
      whitelist: ["def"],
    })

    await duplicateCourseOffering(db, course, { year: course.year, semester: 2 }, ins.id)

    const target = { code: course.code, year: course.year, semester: 2 }
    const [copied] = await listProblems(db, target)
    const detail = await getProblemById(db, copied.id)
    expect(detail?.problemType).toBe("unit")
    expect(detail?.functionName).toBe("add")
    expect(detail?.starterCode).toBe("def add(a, b):")
    expect(detail?.unitTestCode).toBe("assert add(1, 2) == 3")
    expect(detail?.blacklist).toEqual(["eval", "exec"])
    expect(detail?.whitelist).toEqual(["def"])
  })

  it("preserves problem_no order within a week across multiple problems", async () => {
    const { db, course, ins } = await courseFixture()
    const week1 = await getWeekByNo(db, course, 1)
    const base = {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      weekId: week1!.id,
    }
    await createProblem(db, { ...base, title: "First" })
    await createProblem(db, { ...base, title: "Second" })

    await duplicateCourseOffering(db, course, { year: course.year, semester: 2 }, ins.id)

    const target = { code: course.code, year: course.year, semester: 2 }
    const problems = await listProblems(db, target)
    expect(problems.map((p) => [p.problemNo, p.title])).toEqual([
      [1, "First"],
      [2, "Second"],
    ])
  })

  it("does not copy submissions onto the target problems", async () => {
    const { db, course, ins } = await courseFixture()
    const week1 = await getWeekByNo(db, course, 1)
    const srcProblem = await createProblem(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      weekId: week1!.id,
      title: "Graded",
    })
    const student = await createUser(db, { email: "stu@kmitl.ac.th", name: "Stu" })
    await assignRole(db, student.id, "Student")
    await createSubmission(db, {
      problemId: srcProblem.id,
      userId: student.id,
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      code: "print(1)",
      language: "python",
      pointsEarned: 10,
      pointsMax: 10,
      isLate: false,
      results: [],
    })

    await duplicateCourseOffering(db, course, { year: course.year, semester: 2 }, ins.id)

    const target = { code: course.code, year: course.year, semester: 2 }
    const [copied] = await listProblems(db, target)
    expect(await listSubmissionsForProblem(db, copied.id)).toHaveLength(0)
  })

  it("copies every test case of a problem 1:1", async () => {
    const { db, course, ins } = await courseFixture()
    const week1 = await getWeekByNo(db, course, 1)
    const src = await createProblem(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      weekId: week1!.id,
      title: "Echo",
    })
    await setTestCases(db, src.id, [
      { input: "1", expectedOutput: "1", isHidden: false, score: 10, sortOrder: 1 },
      { input: "2", expectedOutput: "2", isHidden: false, score: 10, sortOrder: 2 },
    ])

    await duplicateCourseOffering(db, course, { year: course.year, semester: 2 }, ins.id)

    const target = { code: course.code, year: course.year, semester: 2 }
    const [copied] = await listProblems(db, target)
    const detail = await getProblemById(db, copied.id)
    expect(detail?.testCases).toHaveLength(2)
    expect(detail?.testCases.map((tc) => [tc.input, tc.expectedOutput])).toEqual([
      ["1", "1"],
      ["2", "2"],
    ])
  })

  it("preserves the is_hidden flag of each test case", async () => {
    const { db, course, ins } = await courseFixture()
    const week1 = await getWeekByNo(db, course, 1)
    const src = await createProblem(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      weekId: week1!.id,
      title: "Hidden mix",
    })
    await setTestCases(db, src.id, [
      { input: "a", expectedOutput: "a", isHidden: false, score: 10, sortOrder: 1 },
      { input: "b", expectedOutput: "b", isHidden: true, score: 10, sortOrder: 2 },
    ])

    await duplicateCourseOffering(db, course, { year: course.year, semester: 2 }, ins.id)

    const target = { code: course.code, year: course.year, semester: 2 }
    const [copied] = await listProblems(db, target)
    const detail = await getProblemById(db, copied.id)
    expect(detail?.testCases.map((tc) => tc.isHidden)).toEqual([false, true])
  })

  it("preserves per-case score and sort order, so total points match the source", async () => {
    const { db, course, ins } = await courseFixture()
    const week1 = await getWeekByNo(db, course, 1)
    const src = await createProblem(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      weekId: week1!.id,
      title: "Weighted",
    })
    await setTestCases(db, src.id, [
      { input: "x", expectedOutput: "x", isHidden: false, score: 30, sortOrder: 1 },
      { input: "y", expectedOutput: "y", isHidden: true, score: 70, sortOrder: 2 },
    ])

    await duplicateCourseOffering(db, course, { year: course.year, semester: 2 }, ins.id)

    const target = { code: course.code, year: course.year, semester: 2 }
    const [copied] = await listProblems(db, target)
    const detail = await getProblemById(db, copied.id)
    expect(detail?.testCases.map((tc) => [tc.sortOrder, tc.score])).toEqual([
      [1, 30],
      [2, 70],
    ])
    const total = detail!.testCases.reduce((sum, tc) => sum + tc.score!, 0)
    expect(total).toBe(100)
  })
})
