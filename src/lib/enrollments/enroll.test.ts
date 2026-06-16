import { describe, it, expect, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { enrollStudent } from "./enroll"
import { listEnrollments, type Queryable } from "./repository"
import { createCourse } from "@/lib/courses/repository"
import { createUser, getUserWithRoles, assignRole } from "@/lib/users/repository"

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

const student = {
  idCode: "65010100",
  titleTh: "นาย",
  firstNameTh: "ประพาฬพงษ์",
  lastNameTh: "ธรรมาวาดานันท์",
}

async function seedCourse(db: Queryable, program?: string) {
  return createCourse(db, {
    code: "01076021",
    nameTh: "วิชา",
    nameEn: "Course",
    program: program ?? null,
  })
}

describe("enrollStudent", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
  })

  it("creates a new user with the Student role and enrolls them", async () => {
    const course = await seedCourse(db)

    const result = await enrollStudent(db, course.id, { ...student, studyGroup: "1" })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.created).toBe(true)

    const withRoles = await getUserWithRoles(db, result.userId)
    expect(withRoles?.roles).toEqual(["Student"])

    const { enrollments, total } = await listEnrollments(db, {
      courseId: course.id,
      search: "",
      group: "",
      page: 1,
      pageSize: 10,
    })
    expect(total).toBe(1)
    expect(enrollments[0].sid).toBe("65010100")
    expect(enrollments[0].studyGroup).toBe("1")
  })

  it("reuses an existing user by id_code without overwriting their name", async () => {
    const course = await seedCourse(db)
    const u = await createUser(db, {
      email: "real.name@kmitl.ac.th",
      name: "ชื่อเดิม นามสกุลเดิม",
      idCode: "65010100",
    })

    const result = await enrollStudent(db, course.id, {
      ...student,
      firstNameTh: "ชื่อใหม่",
      lastNameTh: "นามสกุลใหม่",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.created).toBe(false)
    expect(result.userId).toBe(u.id)

    // The stored display name is preserved, not clobbered by the form values.
    const withRoles = await getUserWithRoles(db, u.id)
    expect(withRoles?.name).toBe("ชื่อเดิม นามสกุลเดิม")
  })

  it("ensures the Student role on an existing user, keeping their other roles", async () => {
    const course = await seedCourse(db)
    const u = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA", idCode: "65010100" })
    await assignRole(db, u.id, "TA")

    await enrollStudent(db, course.id, student)

    const withRoles = await getUserWithRoles(db, u.id)
    expect([...(withRoles?.roles ?? [])].sort()).toEqual(["Student", "TA"])
  })

  it("rejects enrolling a student already in the course as a duplicate", async () => {
    const course = await seedCourse(db)
    await enrollStudent(db, course.id, student)

    const again = await enrollStudent(db, course.id, student)
    expect(again.ok).toBe(false)
    if (again.ok) return
    expect(again.reason).toBe("duplicate")

    const { total } = await listEnrollments(db, {
      courseId: course.id,
      search: "",
      group: "",
      page: 1,
      pageSize: 10,
    })
    expect(total).toBe(1)
  })

  it("derives {sid}@kmitl.ac.th when no email is given", async () => {
    const course = await seedCourse(db)
    const result = await enrollStudent(db, course.id, student)
    if (!result.ok) throw new Error("expected ok")

    const withRoles = await getUserWithRoles(db, result.userId)
    expect(withRoles?.email).toBe("65010100@kmitl.ac.th")
  })

  it("uses the provided email when one is given", async () => {
    const course = await seedCourse(db)
    const result = await enrollStudent(db, course.id, { ...student, email: "real@kmitl.ac.th" })
    if (!result.ok) throw new Error("expected ok")

    const withRoles = await getUserWithRoles(db, result.userId)
    expect(withRoles?.email).toBe("real@kmitl.ac.th")
  })

  it("inherits the course default program when none is given, and honors an override", async () => {
    const course = await seedCourse(db, "วิศวกรรมคอมพิวเตอร์")

    await enrollStudent(db, course.id, { ...student, idCode: "65010100" })
    await enrollStudent(db, course.id, {
      ...student,
      idCode: "65010200",
      program: "วิศวกรรมไฟฟ้า",
    })

    const { enrollments } = await listEnrollments(db, {
      courseId: course.id,
      search: "",
      group: "",
      page: 1,
      pageSize: 10,
    })
    const byId = Object.fromEntries(enrollments.map((e) => [e.sid, e.program]))
    expect(byId["65010100"]).toBe("วิศวกรรมคอมพิวเตอร์")
    expect(byId["65010200"]).toBe("วิศวกรรมไฟฟ้า")
  })

  it("does not reuse a legacy user that has no id_code", async () => {
    const course = await seedCourse(db)
    const legacy = await createUser(db, { email: "legacy@kmitl.ac.th", name: "Legacy" })

    const result = await enrollStudent(db, course.id, student)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.created).toBe(true)
    expect(result.userId).not.toBe(legacy.id)
  })
})
