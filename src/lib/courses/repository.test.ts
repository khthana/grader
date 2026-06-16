import { describe, it, expect, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import {
  createCourse,
  getCourseById,
  listCoursesForUser,
  assignInstructor,
  type Queryable,
} from "./repository"
import { createUser, assignRole } from "@/lib/users/repository"

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

describe("course repository", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
  })

  it("creates a course and reads it back by id", async () => {
    const created = await createCourse(db, {
      code: "01076021",
      nameTh: "โครงสร้างข้อมูลและอัลกอริทึม",
      nameEn: "Data Structures and Algorithms",
      program: "วิศวกรรมคอมพิวเตอร์",
    })

    expect(created.id).toBeGreaterThan(0)
    expect(created.code).toBe("01076021")

    const found = await getCourseById(db, created.id)
    expect(found).not.toBeNull()
    expect(found?.id).toBe(created.id)
    expect(found?.nameTh).toBe("โครงสร้างข้อมูลและอัลกอริทึม")
    expect(found?.nameEn).toBe("Data Structures and Algorithms")
    expect(found?.program).toBe("วิศวกรรมคอมพิวเตอร์")
  })

  it("enforces course code uniqueness", async () => {
    await createCourse(db, { code: "01076021", nameTh: "ก", nameEn: "A" })
    await expect(
      createCourse(db, { code: "01076021", nameTh: "ข", nameEn: "B" })
    ).rejects.toThrow()
  })

  it("lists every course for an Admin, regardless of assignment", async () => {
    const admin = await createUser(db, { email: "admin@kmitl.ac.th", name: "Admin" })
    await assignRole(db, admin.id, "Admin")
    await createCourse(db, { code: "C1", nameTh: "หนึ่ง", nameEn: "One" })
    await createCourse(db, { code: "C2", nameTh: "สอง", nameEn: "Two" })

    const courses = await listCoursesForUser(db, admin.id, ["Admin"])
    expect(courses.map((c) => c.code).sort()).toEqual(["C1", "C2"])
  })

  it("lists only assigned courses for a non-admin instructor", async () => {
    const instructor = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
    await assignRole(db, instructor.id, "Instructor")
    const mine = await createCourse(db, { code: "MINE", nameTh: "ของฉัน", nameEn: "Mine" })
    await createCourse(db, { code: "OTHER", nameTh: "อื่น", nameEn: "Other" })
    await assignInstructor(db, mine.id, instructor.id)

    const courses = await listCoursesForUser(db, instructor.id, ["Instructor"])
    expect(courses.map((c) => c.code)).toEqual(["MINE"])
  })

  it("returns no courses for a user with no assignments", async () => {
    const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
    await assignRole(db, ta.id, "TA")
    await createCourse(db, { code: "X", nameTh: "เอ็กซ์", nameEn: "X" })

    expect(await listCoursesForUser(db, ta.id, ["TA"])).toEqual([])
  })
})
