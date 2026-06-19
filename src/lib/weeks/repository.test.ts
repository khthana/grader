import { describe, it, expect, beforeEach } from "vitest"
import {
  seedWeeks,
  listWeeks,
  updateWeekTopic,
  addWeek,
  weekHasProblems,
  deleteWeek,
  DEFAULT_WEEKS,
  MAX_WEEKS,
} from "./repository"
import { createCourse } from "@/lib/courses/repository"
import { createProblem } from "@/lib/problems/repository"
import { freshDb, type Queryable } from "@/lib/test-support/db"
import type { CourseKey } from "@/lib/courses/types"

const KEY: CourseKey = { code: "C01", year: 2567, semester: 1 }

describe("week repository", () => {
  let db: Queryable
  let courseKey: CourseKey

  beforeEach(async () => {
    db = freshDb()
    const course = await createCourse(db, { ...KEY, nameTh: "ก", nameEn: "A" })
    courseKey = { code: course.code, year: course.year, semester: course.semester }
  })

  it("seedWeeks creates DEFAULT_WEEKS rows with empty topics", async () => {
    await seedWeeks(db, courseKey)
    const weeks = await listWeeks(db, courseKey)
    expect(weeks).toHaveLength(DEFAULT_WEEKS)
    expect(weeks[0].weekNo).toBe(1)
    expect(weeks[0].topic).toBe("")
    expect(weeks[DEFAULT_WEEKS - 1].weekNo).toBe(DEFAULT_WEEKS)
    expect(weeks[DEFAULT_WEEKS - 1].topic).toBe("")
  })

  it("listWeeks returns rows ordered by week_no", async () => {
    await seedWeeks(db, courseKey)
    const weeks = await listWeeks(db, courseKey)
    const nos = weeks.map((w) => w.weekNo)
    expect(nos).toEqual([1, 2, 3, 4, 5, 6])
  })

  it("updateWeekTopic persists the new topic", async () => {
    await seedWeeks(db, courseKey)
    const weeks = await listWeeks(db, courseKey)
    const updated = await updateWeekTopic(db, weeks[0].id, "พื้นฐาน Python")
    expect(updated).not.toBeNull()
    expect(updated?.topic).toBe("พื้นฐาน Python")

    const refreshed = await listWeeks(db, courseKey)
    expect(refreshed[0].topic).toBe("พื้นฐาน Python")
  })

  it("updateWeekTopic returns null for unknown id", async () => {
    const result = await updateWeekTopic(db, 99999, "ไม่มี")
    expect(result).toBeNull()
  })

  it("seedWeeks is idempotent — calling twice does not duplicate or error", async () => {
    await seedWeeks(db, courseKey)
    await seedWeeks(db, courseKey)
    const weeks = await listWeeks(db, courseKey)
    expect(weeks).toHaveLength(DEFAULT_WEEKS)
  })

  it("addWeek appends the next week number with an empty topic", async () => {
    await seedWeeks(db, courseKey)
    const added = await addWeek(db, courseKey)
    expect(added?.weekNo).toBe(DEFAULT_WEEKS + 1)
    expect(added?.topic).toBe("")
    const weeks = await listWeeks(db, courseKey)
    expect(weeks).toHaveLength(DEFAULT_WEEKS + 1)
  })

  it("addWeek starts at week 1 for a course with no weeks", async () => {
    const added = await addWeek(db, courseKey)
    expect(added?.weekNo).toBe(1)
  })

  it("addWeek returns null once MAX_WEEKS is reached", async () => {
    for (let i = 0; i < MAX_WEEKS; i++) await addWeek(db, courseKey)
    const weeks = await listWeeks(db, courseKey)
    expect(weeks).toHaveLength(MAX_WEEKS)
    expect(await addWeek(db, courseKey)).toBeNull()
  })

  it("weekHasProblems reflects whether a problem references the week", async () => {
    await seedWeeks(db, courseKey)
    const weeks = await listWeeks(db, courseKey)
    expect(await weekHasProblems(db, weeks[0].id)).toBe(false)
    await createProblem(db, {
      courseCode: courseKey.code,
      courseYear: courseKey.year,
      courseSemester: courseKey.semester,
      weekId: weeks[0].id,
      title: "โจทย์",
    })
    expect(await weekHasProblems(db, weeks[0].id)).toBe(true)
  })

  it("deleteWeek removes the row and returns true", async () => {
    await seedWeeks(db, courseKey)
    const weeks = await listWeeks(db, courseKey)
    const last = weeks[weeks.length - 1]
    expect(await deleteWeek(db, last.id)).toBe(true)
    const after = await listWeeks(db, courseKey)
    expect(after).toHaveLength(DEFAULT_WEEKS - 1)
  })
})
