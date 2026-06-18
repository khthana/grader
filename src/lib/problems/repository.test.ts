import { describe, it, expect, beforeEach } from "vitest"
import {
  createProblem,
  getProblemById,
  listProblems,
  updateProblem,
  deleteProblem,
  setTestCases,
} from "./repository"
import { createCourse } from "@/lib/courses/repository"
import { seedWeeks, listWeeks } from "@/lib/weeks/repository"
import { freshDb, type Queryable } from "@/lib/test-support/db"

describe("problem repository", () => {
  let db: Queryable
  let courseId: number
  let weekId: number

  beforeEach(async () => {
    db = freshDb()
    const course = await createCourse(db, { code: "C01", nameTh: "ก", nameEn: "A" })
    courseId = course.id
    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)
    weekId = weeks[0].id
  })

  it("createProblem returns a record with the given fields", async () => {
    const p = await createProblem(db, {
      courseId,
      weekId,
      title: "Hello World",
      description: "Write a hello world program",
      inputSpec: "none",
      outputSpec: "Hello World",
      language: "python",
    })
    expect(p.id).toBeGreaterThan(0)
    expect(p.courseId).toBe(courseId)
    expect(p.weekId).toBe(weekId)
    expect(p.title).toBe("Hello World")
    expect(p.language).toBe("python")
    expect(p.dueAt).toBeNull()
    expect(p.closeAt).toBeNull()
  })

  it("getProblemById returns null for unknown id", async () => {
    const result = await getProblemById(db, 99999)
    expect(result).toBeNull()
  })

  it("setTestCases replaces test cases atomically (idempotent on repeat)", async () => {
    const p = await createProblem(db, { courseId, weekId, title: "Q1" })
    await setTestCases(db, p.id, [
      { input: "1", expectedOutput: "1", isHidden: false, score: 10, sortOrder: 0 },
      { input: "2", expectedOutput: "4", isHidden: false, score: 10, sortOrder: 1 },
    ])
    // replace with different set
    const cases = await setTestCases(db, p.id, [
      { input: "3", expectedOutput: "9", isHidden: true, score: 5, sortOrder: 0 },
    ])
    expect(cases).toHaveLength(1)
    expect(cases[0].input).toBe("3")
    expect(cases[0].score).toBe(5)
  })

  it("getProblemById returns detail with test cases after setTestCases", async () => {
    const p = await createProblem(db, { courseId, weekId, title: "Q2" })
    await setTestCases(db, p.id, [
      { input: "a", expectedOutput: "A", isHidden: false, score: 5, sortOrder: 0 },
      { input: "b", expectedOutput: "B", isHidden: true, score: 10, sortOrder: 1 },
    ])
    const detail = await getProblemById(db, p.id)
    expect(detail).not.toBeNull()
    expect(detail!.testCases).toHaveLength(2)
    expect(detail!.testCases[0].input).toBe("a")
    expect(detail!.testCases[1].isHidden).toBe(true)
  })

  it("listProblems returns all problems ordered by week_no then id", async () => {
    const weeks = await listWeeks(db, courseId)
    const week2Id = weeks[1].id
    await createProblem(db, { courseId, weekId: week2Id, title: "Week2 Q1" })
    await createProblem(db, { courseId, weekId, title: "Week1 Q1" })
    const list = await listProblems(db, courseId)
    expect(list).toHaveLength(2)
    expect(list[0].weekNo).toBe(1)
    expect(list[0].title).toBe("Week1 Q1")
    expect(list[1].weekNo).toBe(2)
  })

  it("listProblems filters by weekId", async () => {
    const weeks = await listWeeks(db, courseId)
    const week2Id = weeks[1].id
    await createProblem(db, { courseId, weekId, title: "Week1 Q" })
    await createProblem(db, { courseId, weekId: week2Id, title: "Week2 Q" })
    const list = await listProblems(db, courseId, weekId)
    expect(list).toHaveLength(1)
    expect(list[0].weekNo).toBe(1)
  })

  it("listProblems includes pointsMax as sum of test case scores", async () => {
    const p = await createProblem(db, { courseId, weekId, title: "Scored" })
    await setTestCases(db, p.id, [
      { input: "", expectedOutput: "", isHidden: false, score: 10, sortOrder: 0 },
      { input: "", expectedOutput: "", isHidden: false, score: 15, sortOrder: 1 },
    ])
    const list = await listProblems(db, courseId)
    expect(list[0].pointsMax).toBe(25)
  })

  it("updateProblem persists changes and returns updated record", async () => {
    const p = await createProblem(db, { courseId, weekId, title: "Old Title" })
    const updated = await updateProblem(db, p.id, { title: "New Title", description: "desc" })
    expect(updated).not.toBeNull()
    expect(updated!.title).toBe("New Title")
    expect(updated!.description).toBe("desc")
  })

  it("updateProblem returns null for unknown id", async () => {
    const result = await updateProblem(db, 99999, { title: "X" })
    expect(result).toBeNull()
  })

  it("deleteProblem cascades to test_cases", async () => {
    const p = await createProblem(db, { courseId, weekId, title: "To Delete" })
    await setTestCases(db, p.id, [
      { input: "", expectedOutput: "", isHidden: false, score: 5, sortOrder: 0 },
    ])
    const deleted = await deleteProblem(db, p.id)
    expect(deleted).toBe(true)
    expect(await getProblemById(db, p.id)).toBeNull()
    // test_cases should be gone (CASCADE)
    const { rows } = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM test_cases WHERE problem_id = $1::int`,
      [p.id]
    )
    expect(rows[0].count).toBe("0")
  })
})
