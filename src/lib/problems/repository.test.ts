import { describe, it, expect, beforeEach } from "vitest"
import {
  createProblem,
  getProblemById,
  getProblemByWeekAndNo,
  getProblemForCourse,
  getReferenceSolution,
  getReferenceSolutionForStaff,
  listProblems,
  updateProblem,
  deleteProblem,
  setTestCases,
} from "./repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { createUser, assignRole } from "@/lib/users/repository"
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
    const found = await getProblemByWeekAndNo(db, courseKey, weeks[0].id, p.problemNo)
    expect(found?.id).toBe(p.id)
    expect(await getProblemByWeekAndNo(db, courseKey, weeks[0].id, 999)).toBeNull()
  })

  it("getProblemByWeekAndNo ignores a problem of another course sitting in this Week (#88)", async () => {
    const weeks = await listWeeks(db, courseKey)
    const other = await createCourse(db, {
      code: "OTHER", year: courseKey.year, semester: courseKey.semester, nameTh: "ข", nameEn: "B",
    })
    // A row planted before #88 (createProblem now refuses it): another
    // course's problem sitting in our Week.
    await db.query(
      `INSERT INTO problems (course_code, course_year, course_semester, week_id, problem_no, title)
       VALUES ($1, $2::int, $3::int, $4::int, 1, 'planted')`,
      [other.code, other.year, other.semester, weeks[0].id]
    )
    expect(await getProblemByWeekAndNo(db, courseKey, weeks[0].id, 1)).toBeNull()
  })

  it("createProblem refuses a Week of another course (#88)", async () => {
    const weeks = await listWeeks(db, courseKey)
    const other = await createCourse(db, {
      code: "OTHER", year: courseKey.year, semester: courseKey.semester, nameTh: "ข", nameEn: "B",
    })
    await expect(
      createProblem(db, {
        courseCode: other.code, courseYear: other.year, courseSemester: other.semester,
        weekId: weeks[0].id, title: "planted",
      })
    ).rejects.toThrow(/does not belong/)
  })

  it("getProblemForCourse returns the problem only for its own course, else null", async () => {
    const p = await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId, title: "Scoped Q",
    })
    const mine = await getProblemForCourse(db, courseKey, p.id)
    expect(mine?.id).toBe(p.id)

    // A different course cannot read it — folds the ownership check into the read.
    const other = await createCourse(db, { code: "C77", year: 2567, semester: 1, nameTh: "อื่น", nameEn: "Other" })
    expect(await getProblemForCourse(db, other, p.id)).toBeNull()
    expect(await getProblemForCourse(db, courseKey, 999999)).toBeNull()
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
    const list = await listProblems(db, courseKey, { weekId })
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

    describe("getReferenceSolutionForStaff — gate rides the read (#73)", () => {
      let problemId: number
      let insId: number

      async function userWith(email: string, role: string) {
        const u = await createUser(db, { email, name: email })
        await assignRole(db, u.id, role)
        return { id: u.id, roles: [role] }
      }

      beforeEach(async () => {
        problemId = (
          await createProblem(db, {
            courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
            weekId, title: "Q", referenceSolution: "print('secret')",
          })
        ).id
        const ins = await userWith("ins@kmitl.ac.th", "Instructor")
        await assignInstructor(db, courseKey, ins.id)
        insId = ins.id
      })

      const read = (user: { id: number; roles: string[] }, course: CourseKey = courseKey, id = problemId) =>
        getReferenceSolutionForStaff(db, { problemId: id, course, user })

      it("returns the value to a manager of the problem's course", async () => {
        expect(await read({ id: insId, roles: ["Instructor"] })).toEqual({ ok: true, solution: "print('secret')" })
        expect(await read(await userWith("admin@kmitl.ac.th", "Admin"))).toEqual({ ok: true, solution: "print('secret')" })
      })

      it("forbids an Instructor who does not teach this course", async () => {
        const outsider = await userWith("other@kmitl.ac.th", "Instructor")
        expect(await read(outsider)).toEqual({ ok: false, reason: "forbidden" })
      })

      it("forbids non-managers of the course (TA, Student)", async () => {
        const ta = await userWith("ta@kmitl.ac.th", "TA")
        await assignInstructor(db, courseKey, ta.id)
        expect(await read(ta)).toEqual({ ok: false, reason: "forbidden" })
        expect(await read({ id: insId, roles: ["Student"] })).toEqual({ ok: false, reason: "forbidden" })
      })

      it("forbids reading a problem through a course it does not belong to", async () => {
        const other = await createCourse(db, { code: "C02", year: 2567, semester: 1, nameTh: "ข", nameEn: "B" })
        await assignInstructor(db, other, insId)
        // Manager of C02, asking for a C01 problem via the C02 key.
        expect(await read({ id: insId, roles: ["Instructor"] }, other)).toEqual({ ok: false, reason: "forbidden" })
      })
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

  it("createProblem with unitTestCode → getProblemById returns it; default is empty", async () => {
    const withBlock = await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId, title: "Block Q",
      problemType: "unit",
      unitTestCode: "assert add(1, 2) == 3",
    })
    expect((await getProblemById(db, withBlock.id))?.unitTestCode).toBe("assert add(1, 2) == 3")

    const without = await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId, title: "No Block Q",
    })
    expect((await getProblemById(db, without.id))?.unitTestCode).toBe("")
  })

  it("updateProblem can patch unitTestCode", async () => {
    const p = await createProblem(db, {
      courseCode: courseKey.code, courseYear: courseKey.year, courseSemester: courseKey.semester,
      weekId, title: "Q",
    })
    await updateProblem(db, p.id, { unitTestCode: "assert solve() == 42" })
    expect((await getProblemById(db, p.id))?.unitTestCode).toBe("assert solve() == 42")
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
