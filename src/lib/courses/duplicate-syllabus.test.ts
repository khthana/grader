import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { courseFixture, setTestDb } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import { EMPTY_SYLLABUS, type Syllabus } from "@/lib/syllabus/draft"
import { getSyllabus, saveSyllabus } from "@/lib/syllabus/repository"
import { duplicateCourseOffering } from "./duplicate"

// Course duplication copies the Syllabus as the new term's starting point (#103, ADR 0006).
describe("duplicateCourseOffering — Syllabus", () => {
  let f: CourseFixture
  const target = () => ({ code: f.course.code, year: f.course.year, semester: 2 })
  const duplicate = () => duplicateCourseOffering(f.db, f.course, { year: target().year, semester: target().semester }, f.ins.id)

  const syllabus: Syllabus = {
    credits: "3(2-2-5)",
    description: "วิชานี้เรียน **โครงสร้างข้อมูล**",
    objectives: "1. อธิบาย Array ได้\n2. เขียน Linked List ได้",
    plan: [
      { weekNo: 1, topic: "แนะนำวิชา", detail: "ภาพรวม" },
      { weekNo: 2, topic: "Loop ตอน 2", detail: "" },
      { weekNo: 2, topic: "Loop ตอน 1", detail: "" },
      { weekNo: 8, topic: "สอบกลางภาค", detail: "" },
    ],
    assessments: [
      { name: "สอบปลายภาค", weight: 30, note: "" },
      { name: "งาน/แบบฝึกหัด", weight: 27.5, note: "รายสัปดาห์" },
      { name: "สอบกลางภาค", weight: 30, note: "" },
      { name: "การเข้าเรียน", weight: 12.5, note: "" },
    ],
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
  })
  afterEach(() => setTestDb(null))

  it("copies the main row, the Teaching Plan and the Assessment Components 1:1 in order", async () => {
    await saveSyllabus(f.db, f.course, syllabus, f.ins.id)
    expect((await duplicate()).ok).toBe(true)
    expect(await getSyllabus(f.db, target())).toEqual(syllabus)
  })

  it("a source with no Syllabus creates nothing — the target reads as empty", async () => {
    expect((await duplicate()).ok).toBe(true)
    expect(await getSyllabus(f.db, target())).toEqual(EMPTY_SYLLABUS)
    const { rows } = await f.db.query(
      `SELECT 1 FROM course_syllabi WHERE course_code = $1 AND course_year = $2::int AND course_semester = $3::int`,
      [target().code, target().year, target().semester]
    )
    expect(rows).toEqual([])
  })

  it("editing the copy leaves the source's Syllabus unchanged", async () => {
    await saveSyllabus(f.db, f.course, syllabus, f.ins.id)
    await duplicate()
    await saveSyllabus(f.db, target(), { ...EMPTY_SYLLABUS, credits: "4" }, f.ins.id)
    expect(await getSyllabus(f.db, f.course)).toEqual(syllabus)
    expect(await getSyllabus(f.db, target())).toEqual({ ...EMPTY_SYLLABUS, credits: "4" })
  })
})
