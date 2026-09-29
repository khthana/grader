// #82 — one gate for "may this user see this Problem?", shared by the problem
// page, the [pid] API, /api/grade and the legacy /problems/[id] redirectors.
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { canSeeWeek, resolveProblemVisibility } from "./problem-access"
import { createProblem } from "./repository"
import { createUser, assignRole, getUserWithRoles, type UserWithRoles } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { listWeeks, setWeekReleased } from "@/lib/weeks/repository"
import { courseFixture, setTestDb, type CourseFixture } from "@/lib/test-support/db"

describe("canSeeWeek (#82)", () => {
  it("staff see every week; others only released ones", () => {
    expect(canSeeWeek({ staff: true }, { isReleased: false })).toBe(true)
    expect(canSeeWeek({ staff: false }, { isReleased: true })).toBe(true)
    expect(canSeeWeek({ staff: false }, { isReleased: false })).toBe(false)
  })
})

describe("resolveProblemVisibility (#82)", () => {
  let f: CourseFixture
  let released: number
  let hidden: number
  let student: UserWithRoles
  let outsider: UserWithRoles
  let ins: UserWithRoles

  const makeUser = async (email: string, role: string) => {
    const u = await createUser(f.db, { email, name: email })
    await assignRole(f.db, u.id, role)
    return (await getUserWithRoles(f.db, u.id))!
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    const weeks = await listWeeks(f.db, f.course)
    await setWeekReleased(f.db, weeks[0].id, true)
    const mk = async (weekId: number) =>
      (await createProblem(f.db, { courseCode: "C01", courseYear: 2567, courseSemester: 1, weekId, title: "P" })).id
    released = await mk(weeks[0].id)
    hidden = await mk(weeks[1].id)

    student = await makeUser("stu@kmitl.ac.th", "Student")
    await createEnrollment(f.db, { courseCode: "C01", courseYear: 2567, courseSemester: 1, userId: student.id })
    outsider = await makeUser("ins2@kmitl.ac.th", "Instructor")
    ins = (await getUserWithRoles(f.db, f.ins.id))!
  })

  afterEach(() => setTestDb(null))

  it("staff see a problem in a hidden week", async () => {
    const v = await resolveProblemVisibility(f.db, ins, hidden)
    expect(v.kind).toBe("visible")
    if (v.kind !== "visible") return
    expect(v.problem.id).toBe(hidden)
    expect(v.week.weekNo).toBe(2)
    expect(v.access.staff).toBe(true)
  })

  it("an enrolled student sees a problem in a released week", async () => {
    const v = await resolveProblemVisibility(f.db, student, released)
    expect(v.kind).toBe("visible")
    if (v.kind === "visible") expect(v.access.staff).toBe(false)
  })

  it("an enrolled student gets not-found for an unreleased week — same as an unknown id", async () => {
    expect(await resolveProblemVisibility(f.db, student, hidden)).toEqual({ kind: "not-found" })
  })

  it("a user not linked to the course gets not-found, even with a global Instructor role", async () => {
    expect(await resolveProblemVisibility(f.db, outsider, released)).toEqual({ kind: "not-found" })
  })

  it("an unknown id is not-found", async () => {
    expect(await resolveProblemVisibility(f.db, ins, 99999)).toEqual({ kind: "not-found" })
  })
})
