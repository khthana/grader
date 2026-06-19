import { describe, it, expect, beforeEach } from "vitest"
import {
  createEnrollment,
  listEnrollments,
  listGroups,
  listAllEnrollments,
  updateEnrollment,
  deleteEnrollment,
  getEnrollmentByUser,
} from "./repository"
import { createCourse } from "@/lib/courses/repository"
import { createUser } from "@/lib/users/repository"
import { freshDb, type Queryable } from "@/lib/test-support/db"
import type { CourseKey } from "@/lib/courses/types"

const KEY: CourseKey = { code: "C01", year: 2567, semester: 1 }
const KEY2: CourseKey = { code: "C02", year: 2567, semester: 1 }

async function seedCourse(db: Queryable, key: CourseKey = KEY) {
  return createCourse(db, { ...key, nameTh: "วิชา", nameEn: "Course" })
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
  key: CourseKey,
  userId: number,
  fields: { studyGroup?: string; program?: string; year?: string } = {}
) {
  return createEnrollment(db, {
    courseCode: key.code,
    courseYear: key.year,
    courseSemester: key.semester,
    userId,
    ...fields,
  })
}

describe("listEnrollments", () => {
  let db: Queryable

  beforeEach(() => { db = freshDb() })

  it("lists a course's enrolled students with their fields and a total", async () => {
    await seedCourse(db)
    const user = await createUser(db, {
      email: "65010100@kmitl.ac.th",
      name: "ประพาฬพงษ์ ธรรมาวาดานันท์",
      idCode: "65010100",
      titleTh: "นาย",
    })
    await enroll(db, KEY, user.id, { studyGroup: "1", program: "วิศวกรรมคอมพิวเตอร์", year: "2565" })

    const { enrollments, total } = await listEnrollments(db, {
      courseKey: KEY,
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
    await seedCourse(db, KEY)
    await seedCourse(db, KEY2)
    const s1 = await seedStudent(db)
    const s2 = await seedStudent(db)
    await enroll(db, KEY, s1.id)
    await enroll(db, KEY2, s2.id)

    const result = await listEnrollments(db, { courseKey: KEY, search: "", group: "", page: 1, pageSize: 10 })
    expect(result.total).toBe(1)
    expect(result.enrollments.map((e) => e.userId)).toEqual([s1.id])
  })

  it("matches search against student id or name (case-insensitive)", async () => {
    await seedCourse(db)
    const alice = await seedStudent(db, { name: "Alice Wonder", idCode: "64010001" })
    const bob = await seedStudent(db, { name: "Bob Builder", idCode: "64010002" })
    await enroll(db, KEY, alice.id)
    await enroll(db, KEY, bob.id)

    const base = { courseKey: KEY, group: "", page: 1, pageSize: 10 }

    const byName = await listEnrollments(db, { ...base, search: "alice" })
    expect(byName.enrollments.map((e) => e.userId)).toEqual([alice.id])

    const byId = await listEnrollments(db, { ...base, search: "64010002" })
    expect(byId.enrollments.map((e) => e.userId)).toEqual([bob.id])

    const none = await listEnrollments(db, { ...base, search: "zzz" })
    expect(none.total).toBe(0)
    expect(none.enrollments).toEqual([])
  })

  it("filters by group", async () => {
    await seedCourse(db)
    const g1 = await seedStudent(db)
    const g2 = await seedStudent(db)
    await enroll(db, KEY, g1.id, { studyGroup: "1" })
    await enroll(db, KEY, g2.id, { studyGroup: "2" })

    const result = await listEnrollments(db, { courseKey: KEY, search: "", group: "2", page: 1, pageSize: 10 })
    expect(result.total).toBe(1)
    expect(result.enrollments.map((e) => e.userId)).toEqual([g2.id])
  })

  it("paginates while keeping total at the full match count", async () => {
    await seedCourse(db)
    const ids: number[] = []
    for (let i = 0; i < 5; i++) {
      const s = await seedStudent(db)
      await enroll(db, KEY, s.id)
      ids.push(s.id)
    }
    const base = { courseKey: KEY, search: "", group: "" }

    const page1 = await listEnrollments(db, { ...base, page: 1, pageSize: 2 })
    expect(page1.total).toBe(5)
    expect(page1.enrollments).toHaveLength(2)

    const page3 = await listEnrollments(db, { ...base, page: 3, pageSize: 2 })
    expect(page3.total).toBe(5)
    expect(page3.enrollments).toHaveLength(1)
  })
})

describe("listGroups", () => {
  let db: Queryable
  beforeEach(() => { db = freshDb() })

  it("returns the distinct groups in a course, sorted, excluding nulls", async () => {
    await seedCourse(db, KEY)
    await seedCourse(db, KEY2)
    const mk = async (key: CourseKey, group?: string) => {
      const s = await seedStudent(db)
      await enroll(db, key, s.id, group ? { studyGroup: group } : {})
    }
    await mk(KEY, "2")
    await mk(KEY, "1")
    await mk(KEY, "2")
    await mk(KEY)           // null group — excluded
    await mk(KEY2, "9")    // different course — excluded

    expect(await listGroups(db, KEY)).toEqual(["1", "2"])
  })
})

describe("listAllEnrollments", () => {
  let db: Queryable
  beforeEach(() => { db = freshDb() })

  it("returns every matching row with no pagination, respecting search and group", async () => {
    await seedCourse(db)
    for (let i = 0; i < 15; i++) {
      const s = await seedStudent(db)
      await enroll(db, KEY, s.id, { studyGroup: i % 2 === 0 ? "1" : "2" })
    }

    const all = await listAllEnrollments(db, { courseKey: KEY, search: "", group: "" })
    expect(all).toHaveLength(15)

    const g1 = await listAllEnrollments(db, { courseKey: KEY, search: "", group: "1" })
    expect(g1).toHaveLength(8)
    expect(g1.every((e) => e.studyGroup === "1")).toBe(true)
  })

  it("only returns the requested course's rows", async () => {
    await seedCourse(db, KEY)
    await seedCourse(db, KEY2)
    const sa = await seedStudent(db)
    const sb = await seedStudent(db)
    await enroll(db, KEY, sa.id)
    await enroll(db, KEY2, sb.id)

    const all = await listAllEnrollments(db, { courseKey: KEY, search: "", group: "" })
    expect(all.map((e) => e.userId)).toEqual([sa.id])
  })
})

describe("updateEnrollment", () => {
  let db: Queryable
  beforeEach(() => { db = freshDb() })

  it("updates group, program, and year", async () => {
    await seedCourse(db)
    const s = await seedStudent(db)
    await enroll(db, KEY, s.id, { studyGroup: "1", program: "เดิม", year: "2565" })

    const updated = await updateEnrollment(db, KEY, s.id, {
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
    await seedCourse(db)
    expect(await updateEnrollment(db, KEY, 9999, { studyGroup: "1" })).toBeNull()
  })
})

describe("deleteEnrollment", () => {
  let db: Queryable
  beforeEach(() => { db = freshDb() })

  it("removes only the targeted enrollment", async () => {
    await seedCourse(db)
    const s1 = await seedStudent(db)
    const s2 = await seedStudent(db)
    await enroll(db, KEY, s1.id)
    await enroll(db, KEY, s2.id)

    expect(await deleteEnrollment(db, KEY, s1.id)).toBe(true)

    const { enrollments, total } = await listEnrollments(db, {
      courseKey: KEY, search: "", group: "", page: 1, pageSize: 10,
    })
    expect(total).toBe(1)
    expect(enrollments.map((e) => e.userId)).toEqual([s2.id])
  })

  it("returns false for an unknown enrollment", async () => {
    await seedCourse(db)
    expect(await deleteEnrollment(db, KEY, 9999)).toBe(false)
  })
})

describe("getEnrollmentByUser", () => {
  let db: Queryable
  beforeEach(() => { db = freshDb() })

  it("reads an enrollment back with its course and user", async () => {
    await seedCourse(db)
    const s = await seedStudent(db)
    await enroll(db, KEY, s.id, { studyGroup: "1" })

    const found = await getEnrollmentByUser(db, KEY, s.id)
    expect(found?.courseCode).toBe(KEY.code)
    expect(found?.userId).toBe(s.id)
    expect(found?.studyGroup).toBe("1")
    expect(await getEnrollmentByUser(db, KEY, 9999)).toBeNull()
  })
})
