import { describe, it, expect, beforeEach } from "vitest"
import {
  createProblem,
  getProblemById,
  getProblemByWeekAndNo,
  getReferenceSolution,
  listProblems,
  updateProblem,
  deleteProblem,
  setTestCases,
} from "./repository"
import { createCourse } from "@/lib/courses/repository"
import { seedWeeks, listWeeks } from "@/lib/weeks/repository"
import { freshDb, type Queryable } from "@/lib/test-support/db"
import type { CourseKey } from "@/lib/courses/types"

const KEY: CourseKey = { code: "C01", year: 2567, semester: 1 }

describe("problem repository", () => {
  let db: Queryable
  let courseKey: CourseKey
  let weekId: number

  beforeEach(async () => {
    db = freshDb()
    const course = await createCourse(db, { ...KEY, nameTh: "ก", nameEn: "A" })
    courseKey = { code: course.code, year: course.year, semester: course.semester }
    await seedWeeks(db, courseKey)
    const weeks = await listWeeks(db, courseKey)
    weekId = weeks[0].id
  })

  it("createProblem returns a record with the given fields", async () => {
    const p = await createProblem(db, {
      courseCode: courseKey.code,
      courseYear: courseKey.year,
      courseSemester: courseKey.semester,
      weekId,
      title: "Hello World",
      description: "Write a hello world program",
      inputSpec: "none",
      outputSpec: "Hello World",
      language: "python",
    })
    expect(p.id).toBeGreaterThan(0)
    expect(p.courseCode).toBe(courseKey.code)
    expect(p.weekId).toBe(weekId)
    expect(p.problemNo).toBe(1)
    expect(p.title).toBe("Hello World")
    expect(p.language).toBe("python")
    expect(p.score).toBe(10)
    expect(p.dueAt).toBeNull()
    expect(p.closeAt).toBeNull()
  })

  it("createProblem auto-increments problem_no within a week", async () => {
    const p1 = await createProblem(db, { courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester, weekId, title: "Q1" })
    const p2 = await createProblem(db, { courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester, weekId, title: "Q2" })
    expect(p1.problemNo).toBe(1)
    expect(p2.problemNo).toBe(2)
  })

  it("createProblem uses provided score", async () => {
    const p = await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId, title: "Q", score: 25,
    })
    expect(p.score).toBe(25)
  })

  it("getProblemById returns null for unknown id", async () => {
    const result = await getProblemById(db, 99999)
    expect(result).toBeNull()
  })

  it("getProblemByWeekAndNo returns a problem by URL coordinates", async () => {
    const weeks = await listWeeks(db, courseKey)
    const p = await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId: weeks[0].id, title: "Q1",
    })
    const found = await getProblemByWeekAndNo(db, weeks[0].id, p.problemNo)
    expect(found?.id).toBe(p.id)
    expect(await getProblemByWeekAndNo(db, weeks[0].id, 999)).toBeNull()
  })

  it("setTestCases replaces test cases atomically (idempotent on repeat)", async () => {
    const p = await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId, title: "Q1",
    })
    await setTestCases(db, p.id, [
      { input: "1", expectedOutput: "1", isHidden: false, sortOrder: 0 },
      { input: "2", expectedOutput: "4", isHidden: false, sortOrder: 1 },
    ])
    const cases = await setTestCases(db, p.id, [
      { input: "3", expectedOutput: "9", isHidden: true, sortOrder: 0 },
    ])
    expect(cases).toHaveLength(1)
    expect(cases[0].input).toBe("3")
    expect(cases[0].isHidden).toBe(true)
  })

  it("getProblemById returns detail with test cases after setTestCases", async () => {
    const p = await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId, title: "Q2",
    })
    await setTestCases(db, p.id, [
      { input: "a", expectedOutput: "A", isHidden: false, sortOrder: 0 },
      { input: "b", expectedOutput: "B", isHidden: true, sortOrder: 1 },
    ])
    const detail = await getProblemById(db, p.id)
    expect(detail).not.toBeNull()
    expect(detail!.testCases).toHaveLength(2)
    expect(detail!.testCases[0].input).toBe("a")
    expect(detail!.testCases[1].isHidden).toBe(true)
  })

  it("listProblems returns all problems ordered by week_no then problem_no", async () => {
    const weeks = await listWeeks(db, courseKey)
    const week2Id = weeks[1].id
    await createProblem(db, { courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester, weekId: week2Id, title: "Week2 Q1" })
    await createProblem(db, { courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester, weekId, title: "Week1 Q1" })
    const list = await listProblems(db, courseKey)
    expect(list).toHaveLength(2)
    expect(list[0].weekNo).toBe(1)
    expect(list[0].title).toBe("Week1 Q1")
    expect(list[1].weekNo).toBe(2)
  })

  it("listProblems includes score from problem", async () => {
    await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId, title: "Scored", score: 20,
    })
    const list = await listProblems(db, courseKey)
    expect(list[0].score).toBe(20)
  })

  it("listProblems filters by weekId", async () => {
    const weeks = await listWeeks(db, courseKey)
    const week2Id = weeks[1].id
    await createProblem(db, { courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester, weekId, title: "Week1 Q" })
    await createProblem(db, { courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester, weekId: week2Id, title: "Week2 Q" })
    const list = await listProblems(db, courseKey, weekId)
    expect(list).toHaveLength(1)
    expect(list[0].weekNo).toBe(1)
  })

  it("updateProblem persists changes and returns updated record", async () => {
    const p = await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId, title: "Old Title",
    })
    const updated = await updateProblem(db, p.id, { title: "New Title", description: "desc" })
    expect(updated).not.toBeNull()
    expect(updated!.title).toBe("New Title")
    expect(updated!.description).toBe("desc")
  })

  it("updateProblem updates score", async () => {
    const p = await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId, title: "Q", score: 10,
    })
    const updated = await updateProblem(db, p.id, { score: 50 })
    expect(updated!.score).toBe(50)
  })

  it("updateProblem returns null for unknown id", async () => {
    const result = await updateProblem(db, 99999, { title: "X" })
    expect(result).toBeNull()
  })

  describe("reference solution", () => {
    it("createProblem persists referenceSolution and getReferenceSolution returns it", async () => {
      const p = await createProblem(db, {
        courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
        weekId, title: "Q", referenceSolution: "print('hello')",
      })
      const solution = await getReferenceSolution(db, p.id)
      expect(solution).toBe("print('hello')")
    })

    it("getReferenceSolution returns empty string when created without referenceSolution", async () => {
      const p = await createProblem(db, {
        courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
        weekId, title: "Q",
      })
      const solution = await getReferenceSolution(db, p.id)
      expect(solution).toBe("")
    })

    it("updateProblem persists referenceSolution", async () => {
      const p = await createProblem(db, {
        courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
        weekId, title: "Q",
      })
      await updateProblem(db, p.id, { referenceSolution: "print(42)" })
      expect(await getReferenceSolution(db, p.id)).toBe("print(42)")
    })

    it("getProblemById does not expose referenceSolution (leak prevention)", async () => {
      const SECRET = "SECRET_SOLUTION_XK9Z"
      const p = await createProblem(db, {
        courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
        weekId, title: "Q", referenceSolution: SECRET,
      })
      const detail = await getProblemById(db, p.id)
      expect(JSON.stringify(detail)).not.toContain(SECRET)
    })
  })

  it("createProblem with new fields → getProblemById returns them (TEXT[] round-trip)", async () => {
    const p = await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId, title: "Unit Q",
      problemType: "unit",
      functionName: "add",
      starterCode: "def add(a, b):",
      blacklist: ["sort", "sorted"],
      whitelist: ["def"],
    })
    const detail = await getProblemById(db, p.id)
    expect(detail?.problemType).toBe("unit")
    expect(detail?.functionName).toBe("add")
    expect(detail?.starterCode).toBe("def add(a, b):")
    expect(detail?.blacklist).toEqual(["sort", "sorted"])
    expect(detail?.whitelist).toEqual(["def"])
  })

  it("createProblem without new fields → defaults (io, empty strings, empty arrays)", async () => {
    const p = await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId, title: "Default Q",
    })
    const detail = await getProblemById(db, p.id)
    expect(detail?.problemType).toBe("io")
    expect(detail?.functionName).toBe("")
    expect(detail?.starterCode).toBe("")
    expect(detail?.blacklist).toEqual([])
    expect(detail?.whitelist).toEqual([])
  })

  it("updateProblem can patch new fields independently", async () => {
    const p = await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId, title: "Q",
    })
    await updateProblem(db, p.id, {
      problemType: "unit",
      functionName: "solve",
      starterCode: "def solve():",
      blacklist: ["import"],
      whitelist: ["def"],
    })
    const detail = await getProblemById(db, p.id)
    expect(detail?.problemType).toBe("unit")
    expect(detail?.functionName).toBe("solve")
    expect(detail?.starterCode).toBe("def solve():")
    expect(detail?.blacklist).toEqual(["import"])
    expect(detail?.whitelist).toEqual(["def"])
  })

  it("deleteProblem cascades to test_cases", async () => {
    const p = await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId, title: "To Delete",
    })
    await setTestCases(db, p.id, [
      { input: "", expectedOutput: "", isHidden: false, sortOrder: 0 },
    ])
    const deleted = await deleteProblem(db, p.id)
    expect(deleted).toBe(true)
    expect(await getProblemById(db, p.id)).toBeNull()
    const { rows } = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM test_cases WHERE problem_id = $1::int`,
      [p.id]
    )
    expect(rows[0].count).toBe("0")
  })
})
