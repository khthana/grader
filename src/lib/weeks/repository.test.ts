import { describe, it, expect, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import {
  seedWeeks,
  listWeeks,
  updateWeekTopic,
  addWeek,
  weekHasProblems,
  deleteWeek,
  DEFAULT_WEEKS,
  MAX_WEEKS,
  type Queryable,
} from "./repository"
import { createCourse } from "@/lib/courses/repository"
import { createProblem } from "@/lib/problems/repository"

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

describe("week repository", () => {
  let db: Queryable
  let courseId: number

  beforeEach(async () => {
    db = freshDb()
    const course = await createCourse(db, { code: "C01", nameTh: "ก", nameEn: "A" })
    courseId = course.id
  })

  it("seedWeeks creates DEFAULT_WEEKS rows with empty topics", async () => {
    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)
    expect(weeks).toHaveLength(DEFAULT_WEEKS)
    expect(weeks[0].weekNo).toBe(1)
    expect(weeks[0].topic).toBe("")
    expect(weeks[DEFAULT_WEEKS - 1].weekNo).toBe(DEFAULT_WEEKS)
    expect(weeks[DEFAULT_WEEKS - 1].topic).toBe("")
  })

  it("listWeeks returns rows ordered by week_no", async () => {
    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)
    const nos = weeks.map((w) => w.weekNo)
    expect(nos).toEqual([1, 2, 3, 4, 5, 6])
  })

  it("updateWeekTopic persists the new topic", async () => {
    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)
    const updated = await updateWeekTopic(db, weeks[0].id, "พื้นฐาน Python")
    expect(updated).not.toBeNull()
    expect(updated?.topic).toBe("พื้นฐาน Python")

    const refreshed = await listWeeks(db, courseId)
    expect(refreshed[0].topic).toBe("พื้นฐาน Python")
  })

  it("updateWeekTopic returns null for unknown id", async () => {
    const result = await updateWeekTopic(db, 99999, "ไม่มี")
    expect(result).toBeNull()
  })

  it("seedWeeks is idempotent — calling twice does not duplicate or error", async () => {
    await seedWeeks(db, courseId)
    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)
    expect(weeks).toHaveLength(DEFAULT_WEEKS)
  })

  it("addWeek appends the next week number with an empty topic", async () => {
    await seedWeeks(db, courseId)
    const added = await addWeek(db, courseId)
    expect(added?.weekNo).toBe(DEFAULT_WEEKS + 1)
    expect(added?.topic).toBe("")
    const weeks = await listWeeks(db, courseId)
    expect(weeks).toHaveLength(DEFAULT_WEEKS + 1)
  })

  it("addWeek starts at week 1 for a course with no weeks", async () => {
    const added = await addWeek(db, courseId)
    expect(added?.weekNo).toBe(1)
  })

  it("addWeek returns null once MAX_WEEKS is reached", async () => {
    for (let i = 0; i < MAX_WEEKS; i++) await addWeek(db, courseId)
    const weeks = await listWeeks(db, courseId)
    expect(weeks).toHaveLength(MAX_WEEKS)
    expect(await addWeek(db, courseId)).toBeNull()
  })

  it("weekHasProblems reflects whether a problem references the week", async () => {
    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)
    expect(await weekHasProblems(db, weeks[0].id)).toBe(false)
    await createProblem(db, {
      courseId,
      weekId: weeks[0].id,
      title: "โจทย์",
    })
    expect(await weekHasProblems(db, weeks[0].id)).toBe(true)
  })

  it("deleteWeek removes the row and returns true", async () => {
    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)
    const last = weeks[weeks.length - 1]
    expect(await deleteWeek(db, last.id)).toBe(true)
    const after = await listWeeks(db, courseId)
    expect(after).toHaveLength(DEFAULT_WEEKS - 1)
  })
})
