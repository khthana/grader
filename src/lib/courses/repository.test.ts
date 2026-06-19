import { describe, it, expect, beforeEach } from "vitest"
import {
  createCourse,
  getCourseByKey,
  listCoursesForUser,
  assignInstructor,
  updateCourse,
  deleteCourse,
  setCourseInstructors,
  listCourseInstructors,
  searchStaffCandidates,
} from "./repository"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment, getEnrollmentByUser } from "@/lib/enrollments/repository"
import { freshDb, type Queryable } from "@/lib/test-support/db"
import type { CourseKey } from "./types"

const KEY: CourseKey = { code: "C01", year: 2567, semester: 1 }
const course1 = { code: "C01", year: 2567, semester: 1 as const, nameTh: "ก", nameEn: "A" }
const course2 = { code: "C02", year: 2567, semester: 1 as const, nameTh: "ข", nameEn: "B" }

describe("course repository", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
  })

  it("creates a course and reads it back by key", async () => {
    const created = await createCourse(db, {
      code: "01076021",
      year: 2567,
      semester: 1,
      nameTh: "โครงสร้างข้อมูลและอัลกอริทึม",
      nameEn: "Data Structures and Algorithms",
      program: "วิศวกรรมคอมพิวเตอร์",
    })

    expect(created.code).toBe("01076021")
    expect(created.year).toBe(2567)
    expect(created.semester).toBe(1)

    const found = await getCourseByKey(db, created)
    expect(found).not.toBeNull()
    expect(found?.code).toBe("01076021")
    expect(found?.nameTh).toBe("โครงสร้างข้อมูลและอัลกอริทึม")
    expect(found?.nameEn).toBe("Data Structures and Algorithms")
    expect(found?.program).toBe("วิศวกรรมคอมพิวเตอร์")
  })

  it("enforces (code, year, semester) uniqueness — same code different semester is ok", async () => {
    await createCourse(db, { code: "X", year: 2567, semester: 1, nameTh: "ก", nameEn: "A" })
    // same code, same year, same semester → conflict
    await expect(
      createCourse(db, { code: "X", year: 2567, semester: 1, nameTh: "ข", nameEn: "B" })
    ).rejects.toThrow()
    // same code, different semester → ok
    const s2 = await createCourse(db, { code: "X", year: 2567, semester: 2, nameTh: "ข", nameEn: "B" })
    expect(s2.semester).toBe(2)
  })

  it("lists every course for an Admin, regardless of assignment", async () => {
    const admin = await createUser(db, { email: "admin@kmitl.ac.th", name: "Admin" })
    await assignRole(db, admin.id, "Admin")
    await createCourse(db, { code: "C1", year: 2567, semester: 1, nameTh: "หนึ่ง", nameEn: "One" })
    await createCourse(db, { code: "C2", year: 2567, semester: 1, nameTh: "สอง", nameEn: "Two" })

    const courses = await listCoursesForUser(db, admin.id, ["Admin"])
    expect(courses.map((c) => c.code).sort()).toEqual(["C1", "C2"])
  })

  it("lists only assigned courses for a non-admin instructor", async () => {
    const instructor = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, instructor.id, "Instructor")
    const mine = await createCourse(db, { code: "MINE", year: 2567, semester: 1, nameTh: "ของฉัน", nameEn: "Mine" })
    await createCourse(db, { code: "OTHER", year: 2567, semester: 1, nameTh: "อื่น", nameEn: "Other" })
    await assignInstructor(db, mine, instructor.id)

    const courses = await listCoursesForUser(db, instructor.id, ["Instructor"])
    expect(courses.map((c) => c.code)).toEqual(["MINE"])
  })

  it("returns no courses for a user with no assignments", async () => {
    const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
    await assignRole(db, ta.id, "TA")
    await createCourse(db, { code: "X", year: 2567, semester: 1, nameTh: "เอ็กซ์", nameEn: "X" })

    expect(await listCoursesForUser(db, ta.id, ["TA"])).toEqual([])
  })
})

describe("updateCourse", () => {
  let db: Queryable
  beforeEach(() => { db = freshDb() })

  it("updates a course's fields and reflects them on read", async () => {
    const c = await createCourse(db, { ...KEY, nameTh: "เก่า", nameEn: "Old", program: "ก" })

    const updated = await updateCourse(db, c, { nameTh: "ใหม่", nameEn: "New", program: "ข" })
    expect(updated?.nameTh).toBe("ใหม่")
    expect(updated?.nameEn).toBe("New")
    expect(updated?.program).toBe("ข")

    const found = await getCourseByKey(db, c)
    expect(found?.nameTh).toBe("ใหม่")
    expect(found?.program).toBe("ข")
  })

  it("returns null for an unknown course", async () => {
    expect(
      await updateCourse(db, { code: "NOPE", year: 2567, semester: 1 }, { nameTh: "x", nameEn: "X" })
    ).toBeNull()
  })
})

describe("deleteCourse", () => {
  let db: Queryable
  beforeEach(() => { db = freshDb() })

  it("removes the course and cascades its enrollments", async () => {
    const course = await createCourse(db, course1)
    const stu = await createUser(db, { email: "s@kmitl.ac.th", name: "S", idCode: "1" })
    await assignRole(db, stu.id, "Student")
    await createEnrollment(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      userId: stu.id,
    })

    expect(await deleteCourse(db, course)).toBe(true)
    expect(await getCourseByKey(db, course)).toBeNull()
    // enrollment cascaded
    expect(await getEnrollmentByUser(db, course, stu.id)).toBeNull()
    // user survives
    const { rows } = await db.query<{ id: number }>("SELECT id FROM users WHERE id = $1", [stu.id])
    expect(rows).toHaveLength(1)
  })

  it("returns false for an unknown course", async () => {
    expect(await deleteCourse(db, { code: "NOPE", year: 2567, semester: 1 })).toBe(false)
  })
})

describe("setCourseInstructors", () => {
  let db: Queryable
  beforeEach(() => { db = freshDb() })

  async function staff(email: string) {
    const u = await createUser(db, { email, name: email })
    await assignRole(db, u.id, "Instructor")
    return u
  }

  it("replaces the assignment set: adds new, revokes dropped", async () => {
    const course = await createCourse(db, course1)
    const a = await staff("a@kmitl.ac.th")
    const b = await staff("b@kmitl.ac.th")
    const c = await staff("c@kmitl.ac.th")
    await assignInstructor(db, course, a.id)

    await setCourseInstructors(db, course, [b.id, c.id])

    const ids = (await listCourseInstructors(db, course)).map((s) => s.id).sort()
    expect(ids).toEqual([b.id, c.id].sort())
  })

  it("can clear the staff list entirely", async () => {
    const course = await createCourse(db, course1)
    const a = await staff("a@kmitl.ac.th")
    await assignInstructor(db, course, a.id)

    await setCourseInstructors(db, course, [])
    expect(await listCourseInstructors(db, course)).toEqual([])
  })

  it("drives listCoursesForUser entitlement: assigned users see the course, dropped ones don't", async () => {
    const course = await createCourse(db, course1)
    const a = await staff("a@kmitl.ac.th")
    const b = await staff("b@kmitl.ac.th")

    await setCourseInstructors(db, course, [a.id])
    expect((await listCoursesForUser(db, a.id, ["Instructor"])).map((c) => c.code)).toEqual(["C01"])
    expect(await listCoursesForUser(db, b.id, ["Instructor"])).toEqual([])

    await setCourseInstructors(db, course, [b.id])
    expect(await listCoursesForUser(db, a.id, ["Instructor"])).toEqual([])
    expect((await listCoursesForUser(db, b.id, ["Instructor"])).map((c) => c.code)).toEqual(["C01"])
  })
})

describe("searchStaffCandidates", () => {
  let db: Queryable
  beforeEach(() => { db = freshDb() })

  it("returns only Instructor/TA users matching the search, with their roles", async () => {
    const ins = await createUser(db, { email: "alice@kmitl.ac.th", name: "Alice" })
    await assignRole(db, ins.id, "Instructor")
    const ta = await createUser(db, { email: "bob@kmitl.ac.th", name: "Bob" })
    await assignRole(db, ta.id, "TA")
    const student = await createUser(db, { email: "carol@kmitl.ac.th", name: "Carol" })
    await assignRole(db, student.id, "Student")

    const all = await searchStaffCandidates(db, "")
    expect(all.map((u) => u.email).sort()).toEqual(["alice@kmitl.ac.th", "bob@kmitl.ac.th"])
    expect(all.find((u) => u.email === "alice@kmitl.ac.th")?.roles).toContain("Instructor")

    const byName = await searchStaffCandidates(db, "bob")
    expect(byName.map((u) => u.email)).toEqual(["bob@kmitl.ac.th"])
  })
})
