import { describe, it, expect, beforeEach } from "vitest"
import { resolveCourseAccess } from "./course-access"
import { createCourse } from "./repository"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { courseFixture, type CourseFixture } from "@/lib/test-support/db"
import type { CourseKey } from "./types"

// #73 — the one gate course pages share: entitlement to *this* course, and
// staff/manager rights that come from staffing *this* course (Admin excepted).
describe("resolveCourseAccess", () => {
  let f: CourseFixture
  let other: CourseKey

  async function user(email: string, role: string) {
    const u = await createUser(f.db, { email, name: email })
    await assignRole(f.db, u.id, role)
    return { id: u.id, roles: [role] }
  }

  async function enroll(key: CourseKey, userId: number) {
    await createEnrollment(f.db, {
      courseCode: key.code,
      courseYear: key.year,
      courseSemester: key.semester,
      userId,
    })
  }

  beforeEach(async () => {
    f = await courseFixture()
    other = await createCourse(f.db, { code: "C02", year: 2567, semester: 1, nameTh: "ข", nameEn: "B" })
  })

  it("Admin manages every course", async () => {
    const admin = await user("admin@kmitl.ac.th", "Admin")
    expect(await resolveCourseAccess(f.db, admin, other)).toMatchObject({ staff: true, manager: true })
  })

  it("an Instructor manages the course they teach", async () => {
    const access = await resolveCourseAccess(f.db, { id: f.ins.id, roles: ["Instructor"] }, f.course)
    expect(access).toMatchObject({ staff: true, manager: true })
    expect(access?.course.code).toBe("C01")
  })

  it("an Instructor of another course gets nothing here (null)", async () => {
    expect(await resolveCourseAccess(f.db, { id: f.ins.id, roles: ["Instructor"] }, other)).toBeNull()
  })

  it("a TA of the course is staff but not a manager", async () => {
    const access = await resolveCourseAccess(f.db, { id: f.ta.id, roles: ["TA"] }, f.course)
    expect(access).toMatchObject({ staff: true, manager: false })
  })

  it("an enrolled Student is entitled but neither staff nor manager", async () => {
    const stu = await user("stu@kmitl.ac.th", "Student")
    await enroll(f.course, stu.id)
    expect(await resolveCourseAccess(f.db, stu, f.course)).toMatchObject({ staff: false, manager: false })
  })

  it("a user with no link to the course gets null", async () => {
    const stu = await user("stranger@kmitl.ac.th", "Student")
    expect(await resolveCourseAccess(f.db, stu, f.course)).toBeNull()
  })

  it("an Instructor merely enrolled in a course gets student rights there", async () => {
    await enroll(other, f.ins.id)
    const access = await resolveCourseAccess(f.db, { id: f.ins.id, roles: ["Instructor"] }, other)
    expect(access).toMatchObject({ staff: false, manager: false })
  })

  it("an unknown course is null", async () => {
    const admin = await user("admin@kmitl.ac.th", "Admin")
    expect(await resolveCourseAccess(f.db, admin, { code: "NOPE", year: 2567, semester: 1 })).toBeNull()
  })
})
