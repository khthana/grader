// #80 — the legacy /problems/[id] redirectors reveal a problem's course, week
// and position in the Location header, so they only redirect users who could
// open the target anyway.
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { resolveLegacyProblemPath } from "./legacy-path"
import { createProblem } from "./repository"
import { createUser, assignRole, getUserWithRoles, type UserWithRoles } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { listWeeks, setWeekReleased } from "@/lib/weeks/repository"
import { courseFixture, setTestDb, type CourseFixture } from "@/lib/test-support/db"

describe("resolveLegacyProblemPath (#80)", () => {
  let f: CourseFixture
  let released: number
  let hidden: number
  let student: UserWithRoles
  let outsider: UserWithRoles
  let ins: UserWithRoles
  const base = "/courses/C01/2567/1/problems"

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
    // A global Instructor who doesn't teach C01 is still an outsider there.
    outsider = await makeUser("ins2@kmitl.ac.th", "Instructor")
    ins = (await getUserWithRoles(f.db, f.ins.id))!
  })

  afterEach(() => setTestDb(null))

  it("staff of the course are redirected, with the target suffix", async () => {
    expect(await resolveLegacyProblemPath(f.db, ins, hidden, "")).toBe(`${base}/2/1`)
    expect(await resolveLegacyProblemPath(f.db, ins, released, "/edit")).toBe(`${base}/1/1/edit`)
    expect(await resolveLegacyProblemPath(f.db, ins, released, "/submissions")).toBe(`${base}/1/1/submissions`)
  })

  it("an enrolled student is redirected to a problem in a released week", async () => {
    expect(await resolveLegacyProblemPath(f.db, student, released, "")).toBe(`${base}/1/1`)
  })

  it("an enrolled student gets null for a problem in an unreleased week", async () => {
    expect(await resolveLegacyProblemPath(f.db, student, hidden, "")).toBeNull()
  })

  it("a user not linked to the course gets null, whatever their global role", async () => {
    for (const suffix of ["", "/edit", "/submissions"] as const) {
      expect(await resolveLegacyProblemPath(f.db, outsider, released, suffix)).toBeNull()
    }
  })

  it("an unknown id is null", async () => {
    expect(await resolveLegacyProblemPath(f.db, ins, 99999, "")).toBeNull()
  })
})
