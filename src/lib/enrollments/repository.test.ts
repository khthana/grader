import { describe, it, expect, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import {
  createEnrollment,
  listEnrollments,
  listGroups,
  listAllEnrollments,
  updateEnrollment,
  deleteEnrollment,
  getEnrollmentById,
  type Queryable,
} from "./repository"
import { createCourse } from "@/lib/courses/repository"
import { createUser } from "@/lib/users/repository"

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

async function seedCourse(db: Queryable, code = "01076021") {
  return createCourse(db, { code, nameTh: "วิชา", nameEn: "Course" })
}

let userSeq = 0
async function seedStudent(
  db: Queryable,
  fields: { name?: string; idCode?: string; titleTh?: string } = {}
) {
  userSeq += 1
  return createUser(db, {
    email: `stu${userSeq}@kmitl.ac.th`,
    name: fields.name ?? `นักศึกษา ${userSeq}`,
    idCode: fields.idCode,
    titleTh: fields.titleTh,
  })
}

async function enroll(
  db: Queryable,
  courseId: number,
  userId: number,
  fields: { studyGroup?: string; program?: string; year?: string } = {}
) {
  return createEnrollment(db, { courseId, userId, ...fields })
}

describe("listEnrollments", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
  })

  it("lists a course's enrolled students with their fields and a total", async () => {
    const course = await seedCourse(db)
    const user = await createUser(db, {
      email: "65010100@kmitl.ac.th",
      name: "ประพาฬพงษ์ ธรรมาวาดานันท์",
      idCode: "65010100",
      titleTh: "นาย",
    })
    await createEnrollment(db, {
      courseId: course.id,
      userId: user.id,
      studyGroup: "1",
      program: "วิศวกรรมคอมพิวเตอร์",
      year: "2565",
    })

    const { enrollments, total } = await listEnrollments(db, {
      courseId: course.id,
      search: "",
      group: "",
      page: 1,
      pageSize: 10,
    })

    expect(total).toBe(1)
    expect(enrollments).toHaveLength(1)
    const row = enrollments[0]
    expect(row.userId).toBe(user.id)
    expect(row.sid).toBe("65010100")
    expect(row.prefix).toBe("นาย")
    expect(row.name).toBe("ประพาฬพงษ์ ธรรมาวาดานันท์")
    expect(row.studyGroup).toBe("1")
    expect(row.program).toBe("วิศวกรรมคอมพิวเตอร์")
    expect(row.year).toBe("2565")
  })

  it("returns only the requested course's enrollments", async () => {
    const a = await seedCourse(db, "AAA")
    const b = await seedCourse(db, "BBB")
    const s1 = await seedStudent(db)
    const s2 = await seedStudent(db)
    await enroll(db, a.id, s1.id)
    await enroll(db, b.id, s2.id)

    const result = await listEnrollments(db, {
      courseId: a.id,
      search: "",
      group: "",
      page: 1,
      pageSize: 10,
    })

    expect(result.total).toBe(1)
    expect(result.enrollments.map((e) => e.userId)).toEqual([s1.id])
  })

  it("matches search against student id or name (case-insensitive)", async () => {
    const course = await seedCourse(db)
    const alice = await seedStudent(db, { name: "Alice Wonder", idCode: "64010001" })
    const bob = await seedStudent(db, { name: "Bob Builder", idCode: "64010002" })
    await enroll(db, course.id, alice.id)
    await enroll(db, course.id, bob.id)

    const base = { courseId: course.id, group: "", page: 1, pageSize: 10 }

    const byName = await listEnrollments(db, { ...base, search: "alice" })
    expect(byName.enrollments.map((e) => e.userId)).toEqual([alice.id])

    const byId = await listEnrollments(db, { ...base, search: "64010002" })
    expect(byId.enrollments.map((e) => e.userId)).toEqual([bob.id])

    const none = await listEnrollments(db, { ...base, search: "zzz" })
    expect(none.total).toBe(0)
    expect(none.enrollments).toEqual([])
  })

  it("filters by group", async () => {
    const course = await seedCourse(db)
    const g1 = await seedStudent(db)
    const g2 = await seedStudent(db)
    await enroll(db, course.id, g1.id, { studyGroup: "1" })
    await enroll(db, course.id, g2.id, { studyGroup: "2" })

    const result = await listEnrollments(db, {
      courseId: course.id,
      search: "",
      group: "2",
      page: 1,
      pageSize: 10,
    })

    expect(result.total).toBe(1)
    expect(result.enrollments.map((e) => e.userId)).toEqual([g2.id])
  })

  it("paginates while keeping total at the full match count", async () => {
    const course = await seedCourse(db)
    const ids: number[] = []
    for (let i = 0; i < 5; i++) {
      const s = await seedStudent(db)
      await enroll(db, course.id, s.id)
      ids.push(s.id)
    }
    const base = { courseId: course.id, search: "", group: "" }

    const page1 = await listEnrollments(db, { ...base, page: 1, pageSize: 2 })
    expect(page1.total).toBe(5)
    expect(page1.enrollments.map((e) => e.userId)).toEqual([ids[0], ids[1]])

    const page3 = await listEnrollments(db, { ...base, page: 3, pageSize: 2 })
    expect(page3.total).toBe(5)
    expect(page3.enrollments.map((e) => e.userId)).toEqual([ids[4]])
  })
})

describe("listGroups", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
  })

  it("returns the distinct groups in a course, sorted, excluding nulls", async () => {
    const course = await seedCourse(db)
    const other = await seedCourse(db, "OTHER")
    const mk = async (courseId: number, group?: string) => {
      const s = await seedStudent(db)
      await enroll(db, courseId, s.id, group ? { studyGroup: group } : {})
    }
    await mk(course.id, "2")
    await mk(course.id, "1")
    await mk(course.id, "2")
    await mk(course.id) // null group — excluded
    await mk(other.id, "9") // different course — excluded

    expect(await listGroups(db, course.id)).toEqual(["1", "2"])
  })
})

describe("listAllEnrollments", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
  })

  it("returns every matching row with no pagination, respecting search and group", async () => {
    const course = await seedCourse(db)
    for (let i = 0; i < 15; i++) {
      const s = await seedStudent(db)
      await enroll(db, course.id, s.id, { studyGroup: i % 2 === 0 ? "1" : "2" })
    }

    const all = await listAllEnrollments(db, { courseId: course.id, search: "", group: "" })
    expect(all).toHaveLength(15)

    const g1 = await listAllEnrollments(db, { courseId: course.id, search: "", group: "1" })
    expect(g1).toHaveLength(8)
    expect(g1.every((e) => e.studyGroup === "1")).toBe(true)
  })

  it("only returns the requested course's rows", async () => {
    const a = await seedCourse(db, "AAA")
    const b = await seedCourse(db, "BBB")
    const sa = await seedStudent(db)
    const sb = await seedStudent(db)
    await enroll(db, a.id, sa.id)
    await enroll(db, b.id, sb.id)

    const all = await listAllEnrollments(db, { courseId: a.id, search: "", group: "" })
    expect(all.map((e) => e.userId)).toEqual([sa.id])
  })
})

describe("updateEnrollment", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
  })

  it("updates group, program, and year", async () => {
    const course = await seedCourse(db)
    const s = await seedStudent(db)
    const e = await enroll(db, course.id, s.id, { studyGroup: "1", program: "เดิม", year: "2565" })

    const updated = await updateEnrollment(db, e.id, {
      studyGroup: "2",
      program: "ใหม่",
      year: "2566",
    })

    expect(updated).not.toBeNull()
    expect(updated?.studyGroup).toBe("2")
    expect(updated?.program).toBe("ใหม่")
    expect(updated?.year).toBe("2566")
  })

  it("returns null for an unknown enrollment", async () => {
    expect(await updateEnrollment(db, 9999, { studyGroup: "1" })).toBeNull()
  })
})

describe("deleteEnrollment", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
  })

  it("removes only the targeted enrollment", async () => {
    const course = await seedCourse(db)
    const s1 = await seedStudent(db)
    const s2 = await seedStudent(db)
    const e1 = await enroll(db, course.id, s1.id)
    await enroll(db, course.id, s2.id)

    expect(await deleteEnrollment(db, e1.id)).toBe(true)

    const { enrollments, total } = await listEnrollments(db, {
      courseId: course.id,
      search: "",
      group: "",
      page: 1,
      pageSize: 10,
    })
    expect(total).toBe(1)
    expect(enrollments.map((e) => e.userId)).toEqual([s2.id])
  })

  it("returns false for an unknown enrollment", async () => {
    expect(await deleteEnrollment(db, 9999)).toBe(false)
  })
})

describe("getEnrollmentById", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
  })

  it("reads an enrollment back with its course and user", async () => {
    const course = await seedCourse(db)
    const s = await seedStudent(db)
    const e = await enroll(db, course.id, s.id, { studyGroup: "1" })

    const found = await getEnrollmentById(db, e.id)
    expect(found?.courseId).toBe(course.id)
    expect(found?.userId).toBe(s.id)
    expect(await getEnrollmentById(db, 9999)).toBeNull()
  })
})
