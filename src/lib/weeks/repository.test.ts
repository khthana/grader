import { describe, it, expect, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import {
  seedWeeks,
  listWeeks,
  updateWeekTopic,
  type Queryable,
} from "./repository"
import { createCourse } from "@/lib/courses/repository"

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

  it("seedWeeks creates 8 rows with default topics", async () => {
    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)
    expect(weeks).toHaveLength(8)
    expect(weeks[0].weekNo).toBe(1)
    expect(weeks[0].topic).toBe("สัปดาห์ที่ 1")
    expect(weeks[7].weekNo).toBe(8)
    expect(weeks[7].topic).toBe("สัปดาห์ที่ 8")
  })

  it("listWeeks returns rows ordered by week_no", async () => {
    await seedWeeks(db, courseId)
    const weeks = await listWeeks(db, courseId)
    const nos = weeks.map((w) => w.weekNo)
    expect(nos).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
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
    expect(weeks).toHaveLength(8)
  })
})
