import { describe, it, expect } from "vitest"
import { courseFixture } from "@/lib/test-support/db"
import { createCourse, getCourseByKey, listCourseInstructors } from "@/lib/courses/repository"
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
})
