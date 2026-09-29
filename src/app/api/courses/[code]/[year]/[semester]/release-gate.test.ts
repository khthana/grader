// #74 — the Week-release gate and course-scoped staff rights are enforced by
// the API, not just the UI. One fixture across every student-reachable route:
//   course A (C01): Student enrolled; week 1 released (P1), week 2 hidden (P2)
//   course B (C02): A's TA is enrolled here as a *student*
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET as listProblemsRoute } from "./problems/route"
import { GET as getProblemRoute, DELETE as deleteProblemRoute } from "./problems/[pid]/route"
import { GET as listWeeksRoute } from "./weeks/route"
import { GET as assignmentsRoute } from "./assignments/route"
import { GET as gradebookRoute } from "./gradebook/route"
import { GET as studentsRoute } from "./students/route"
import { POST as grade } from "@/app/api/grade/route"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { createProblem, setTestCases } from "@/lib/problems/repository"
import { seedWeeks, listWeeks, setWeekReleased } from "@/lib/weeks/repository"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import type { CourseKey } from "@/lib/courses/types"

vi.mock("@/lib/piston", () => ({
  runTestCases: vi.fn(),
  runUnitTestBlock: vi.fn(),
}))
import { runTestCases } from "@/lib/piston"
const mockRun = vi.mocked(runTestCases)

const STUDENT = "stu@kmitl.ac.th"
const OUTSIDER = "out@kmitl.ac.th"
const OTHER_INS = "ins2@kmitl.ac.th"
const TA = "ta@kmitl.ac.th"
const INS = "ins@kmitl.ac.th"

describe("week release + course-scoped staff rights in the API (#74)", () => {
  let f: CourseFixture
  let courseB: CourseKey
  const ids = { a1: 0, a2: 0, b1: 0, b2: 0 }

  const slug = (c: CourseKey) => ({ code: c.code, year: String(c.year), semester: String(c.semester) })
  const params = (c: CourseKey) => ({ params: Promise.resolve(slug(c)) })
  const pidParams = (c: CourseKey, pid: number) => ({ params: Promise.resolve({ ...slug(c), pid: String(pid) }) })
  const get = (c: CourseKey, path: string, email: string) => {
    const r = new NextRequest(`http://localhost/api/courses/${c.code}/${c.year}/${c.semester}${path}`)
    r.cookies.set("session", sessionFor(email))
    return r
  }
  const gradeReq = (problemId: number, mode: "run" | "submit", email: string) => {
    const r = new NextRequest("http://localhost/api/grade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ problemId, code: "print(1)", mode }),
    })
    r.cookies.set("session", sessionFor(email))
    return r
  }

  async function seedCourse(key: CourseKey): Promise<[number, number]> {
    const weeks = await listWeeks(f.db, key)
    await setWeekReleased(f.db, weeks[0].id, true)
    const mk = async (weekId: number, title: string) => {
      const p = await createProblem(f.db, {
        courseCode: key.code,
        courseYear: key.year,
        courseSemester: key.semester,
        weekId,
        title,
      })
      await setTestCases(f.db, p.id, [
        { input: "", expectedOutput: "1", isHidden: false, score: 10, sortOrder: 0 },
        { input: "", expectedOutput: "SECRET", isHidden: true, score: 10, sortOrder: 1 },
      ])
      return p.id
    }
    return [await mk(weeks[0].id, "Released"), await mk(weeks[1].id, "Hidden")]
  }

  const enroll = (key: CourseKey, userId: number) =>
    createEnrollment(f.db, { courseCode: key.code, courseYear: key.year, courseSemester: key.semester, userId })

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    mockRun.mockReset()
    mockRun.mockResolvedValue([])

    const stu = await createUser(f.db, { email: STUDENT, name: "S" })
    await assignRole(f.db, stu.id, "Student")
    await enroll(f.course, stu.id)
    const out = await createUser(f.db, { email: OUTSIDER, name: "O" })
    await assignRole(f.db, out.id, "Student")
    const ins2 = await createUser(f.db, { email: OTHER_INS, name: "I2" })
    await assignRole(f.db, ins2.id, "Instructor")

    courseB = await createCourse(f.db, { code: "C02", year: 2567, semester: 1, nameTh: "ข", nameEn: "B" })
    await assignInstructor(f.db, courseB, ins2.id)
    await seedWeeks(f.db, courseB)
    await enroll(courseB, f.ta.id)

    ;[ids.a1, ids.a2] = await seedCourse(f.course)
    ;[ids.b1, ids.b2] = await seedCourse(courseB)
  })

  afterEach(() => setTestDb(null))

  describe("Student in an unreleased week", () => {
    it("problem list omits it; staff still see it", async () => {
      const titles = async (email: string) =>
        ((await (await listProblemsRoute(get(f.course, "/problems", email), params(f.course))).json()).problems as Array<{ id: number }>).map((p) => p.id)
      expect(await titles(STUDENT)).toEqual([ids.a1])
      expect(await titles(INS)).toEqual([ids.a1, ids.a2])
    })

    it("problem detail is 404; staff get 200", async () => {
      const call = (email: string) =>
        getProblemRoute(get(f.course, `/problems/${ids.a2}`, email), pidParams(f.course, ids.a2))
      expect((await call(STUDENT)).status).toBe(404)
      expect((await call(INS)).status).toBe(200)
    })

    it("assignments omit it", async () => {
      const res = await assignmentsRoute(get(f.course, "/assignments", STUDENT), params(f.course))
      const items = (await res.json()).assignments as Array<{ problemId: number }>
      expect(items.map((a) => a.problemId)).toEqual([ids.a1])
    })

    it("cannot run or submit it — and can't tell it from an unknown id (#80)", async () => {
      const probe = async (id: number, mode: "run" | "submit") => {
        const res = await grade(gradeReq(id, mode, STUDENT))
        return { status: res.status, body: await res.json() }
      }
      for (const mode of ["run", "submit"] as const) {
        expect(await probe(ids.a2, mode)).toEqual({ status: 404, body: { error: "Problem not found" } })
        expect(await probe(ids.a2, mode)).toEqual(await probe(99999, mode))
      }
      expect(mockRun).not.toHaveBeenCalled()
    })

    it("can still run a released problem", async () => {
      expect((await grade(gradeReq(ids.a1, "run", STUDENT))).status).toBe(200)
    })

    it("staff can run a problem in a hidden week", async () => {
      expect((await grade(gradeReq(ids.a2, "run", INS))).status).toBe(200)
    })
  })

  describe("non-entitled users on /api/grade", () => {
    // 404, same as an unknown id — a 403 would confirm the problem exists (#80).
    it("a Student not in the course gets 404 on mode:run", async () => {
      expect((await grade(gradeReq(ids.a1, "run", OUTSIDER))).status).toBe(404)
      expect(mockRun).not.toHaveBeenCalled()
    })

    it("an Instructor of another course gets 404 on run and submit", async () => {
      expect((await grade(gradeReq(ids.a1, "run", OTHER_INS))).status).toBe(404)
      expect((await grade(gradeReq(ids.a1, "submit", OTHER_INS))).status).toBe(404)
    })
  })

  describe("TA of course A enrolled as a student in course B", () => {
    it("sees only released weeks in B", async () => {
      const res = await listWeeksRoute(get(courseB, "/weeks", TA), params(courseB))
      const weeks = (await res.json()).weeks as Array<{ isReleased: boolean }>
      expect(weeks.every((w) => w.isReleased)).toBe(true)
    })

    it("gets the student view of B's problems (no hidden tests, no hidden weeks)", async () => {
      const detail = await getProblemRoute(get(courseB, `/problems/${ids.b1}`, TA), pidParams(courseB, ids.b1))
      const { problem } = await detail.json()
      expect(problem.testCases.some((tc: { isHidden: boolean }) => tc.isHidden)).toBe(false)
      const hidden = await getProblemRoute(get(courseB, `/problems/${ids.b2}`, TA), pidParams(courseB, ids.b2))
      expect(hidden.status).toBe(404)
    })

    it("is refused B's staff reads (gradebook, roster)", async () => {
      expect((await gradebookRoute(get(courseB, "/gradebook", TA), params(courseB))).status).toBe(403)
      expect((await studentsRoute(get(courseB, "/students", TA), params(courseB))).status).toBe(403)
    })

    it("cannot grade B's hidden-week problem and gets redacted results", async () => {
      expect((await grade(gradeReq(ids.b2, "run", TA))).status).toBe(404)
      mockRun.mockImplementation(async (_code, cases) =>
        cases.map((tc) => ({
          testCaseId: tc.id,
          passed: false,
          actualOutput: "x",
          expectedOutput: tc.expectedOutput,
          executionTime: 0,
        }))
      )
      const res = await grade(gradeReq(ids.b1, "submit", TA))
      expect(res.status).toBe(200)
      expect(JSON.stringify(await res.json())).not.toContain("SECRET")
    })

    it("an Instructor of A enrolled in B cannot manage B's problems", async () => {
      await enroll(courseB, f.ins.id)
      const del = (email: string) =>
        deleteProblemRoute(
          new NextRequest(`http://localhost/api/courses/C02/2567/1/problems/${ids.b1}`, {
            method: "DELETE",
            headers: { cookie: `session=${sessionFor(email)}` },
          }),
          pidParams(courseB, ids.b1)
        )
      expect((await del(INS)).status).toBe(403)
      expect((await del(OTHER_INS)).status).toBe(200)
    })

    it("keeps full staff rights in A", async () => {
      expect((await gradebookRoute(get(f.course, "/gradebook", TA), params(f.course))).status).toBe(200)
    })
  })
})
