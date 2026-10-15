import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, PUT } from "./route"
import { createCourse } from "@/lib/courses/repository"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { listLogs } from "@/lib/logs"
import { createQuiz } from "@/lib/quizzes/repository"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import type { CourseKey } from "@/lib/courses/types"

const HOUR = 3_600_000
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

interface Slot {
  opensAt: string | null
  closesAt: string | null
  state: string
}
interface Row {
  groupKey: string
  label: string
  windows: { pre: Slot; post: Slot }
}

describe("/api/courses/[code]/[year]/[semester]/quizzes/[qid]/windows", () => {
  let f: CourseFixture
  let quizId: number
  let n = 0

  function req(method: string, body?: unknown, email = f.ins.email) {
    const r = new NextRequest(
      `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/quizzes/${quizId}/windows`,
      { method, body: body === undefined ? undefined : JSON.stringify(body) }
    )
    r.cookies.set("session", sessionFor(email))
    return r
  }
  const ctx = (id: number = quizId) => ({
    params: Promise.resolve({
      code: f.course.code,
      year: String(f.course.year),
      semester: String(f.course.semester),
      qid: String(id),
    }),
  })

  async function enroll(group: string | null) {
    n += 1
    const s = await createUser(f.db, { email: `s${n}@kmitl.ac.th`, name: `S${n}` })
    await assignRole(f.db, s.id, "Student")
    await createEnrollment(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      userId: s.id,
      studyGroup: group,
    })
    return s
  }

  async function quiz(key: CourseKey = f.course) {
    return createQuiz(f.db, key, {
      title: "Pre W1",
      description: "",
      weekId: null,
      dontKnowEnabled: true,
      questions: [
        {
          topic: "",
          prompt: "p",
          code: null,
          choices: [{ letter: "A", text: "a" }, { letter: "B", text: "b" }],
          correctLetter: "A",
          feedback: "",
        },
      ],
    })
  }

  async function grid(email = f.ins.email): Promise<Row[]> {
    const res = await GET(req("GET", undefined, email), ctx())
    expect(res.status).toBe(200)
    return (await res.json()).groups
  }
  const row = (rows: Row[], key: string) => rows.find((r) => r.groupKey === key)!

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    quizId = (await quiz()).id
    await enroll("2")
    await enroll("1")
    await enroll(null)
  })
  afterEach(() => setTestDb(null))

  describe("GET", () => {
    it("lists every roster Group plus ไม่ระบุกลุ่ม, all rounds not yet open", async () => {
      const rows = await grid()
      expect(rows.map((r) => [r.groupKey, r.label])).toEqual([
        ["1", "กลุ่ม 1"],
        ["2", "กลุ่ม 2"],
        ["", "ไม่ระบุกลุ่ม"],
      ])
      for (const r of rows) {
        expect(r.windows.pre).toEqual({ opensAt: null, closesAt: null, state: "not-open" })
        expect(r.windows.post).toEqual({ opensAt: null, closesAt: null, state: "not-open" })
      }
    })

    it("is readable by a TA; a student is refused", async () => {
      expect(await grid(f.ta.email)).toHaveLength(3)
      const s = await enroll("1")
      expect((await GET(req("GET", undefined, s.email), ctx())).status).toBe(403)
    })

    it("404s another course's Quiz", async () => {
      const other = await createCourse(f.db, { code: "C99", year: 2567, semester: 1, nameTh: "อื่น", nameEn: "O" })
      const foreign = await quiz(other)
      expect((await GET(req("GET"), ctx(foreign.id))).status).toBe(404)
    })
  })

  describe("PUT", () => {
    it("schedules a window for one Group and reports its state", async () => {
      const opensAt = at(-HOUR)
      const closesAt = at(HOUR)
      const res = await PUT(req("PUT", { windows: [{ round: "pre", groupKey: "1", opensAt, closesAt }] }), ctx())
      expect(res.status).toBe(200)
      const rows: Row[] = (await res.json()).groups
      expect(row(rows, "1").windows.pre).toEqual({ opensAt, closesAt, state: "open" })
      expect(row(rows, "2").windows.pre.state).toBe("not-open")
      expect((await listLogs(f.db, { action: "quiz.window", page: 1, pageSize: 50 })).logs).toHaveLength(1)
    })

    it('"now" opens and later closes a window by the server clock', async () => {
      await PUT(req("PUT", { windows: [{ round: "pre", groupKey: "", opensAt: "now" }] }), ctx())
      expect(row(await grid(), "").windows.pre.state).toBe("open")

      await PUT(req("PUT", { windows: [{ round: "pre", groupKey: "", closesAt: "now" }] }), ctx())
      const pre = row(await grid(), "").windows.pre
      expect(pre.state).toBe("closed")
      expect(pre.opensAt).not.toBeNull() // the omitted open instant was kept
    })

    it("applies one window to every Group at once", async () => {
      const opensAt = at(HOUR)
      const windows = ["1", "2", ""].map((groupKey) => ({ round: "post", groupKey, opensAt, closesAt: null }))
      await PUT(req("PUT", { windows }), ctx())
      for (const r of await grid()) expect(r.windows.post).toMatchObject({ opensAt, state: "not-open" })
    })

    it("reopens a closed window by setting a later close", async () => {
      await PUT(req("PUT", { windows: [{ round: "pre", groupKey: "1", opensAt: at(-2 * HOUR), closesAt: at(-HOUR) }] }), ctx())
      expect(row(await grid(), "1").windows.pre.state).toBe("closed")
      await PUT(req("PUT", { windows: [{ round: "pre", groupKey: "1", closesAt: at(HOUR) }] }), ctx())
      expect(row(await grid(), "1").windows.pre.state).toBe("open")
    })

    it("clears an instant with null", async () => {
      await PUT(req("PUT", { windows: [{ round: "pre", groupKey: "1", opensAt: at(-HOUR) }] }), ctx())
      await PUT(req("PUT", { windows: [{ round: "pre", groupKey: "1", opensAt: null }] }), ctx())
      expect(row(await grid(), "1").windows.pre).toEqual({ opensAt: null, closesAt: null, state: "not-open" })
    })

    it("refuses Pre and Post of the same Group overlapping, and saves nothing", async () => {
      await PUT(req("PUT", { windows: [{ round: "pre", groupKey: "1", opensAt: at(-HOUR), closesAt: at(HOUR) }] }), ctx())
      const res = await PUT(
        req("PUT", {
          windows: [
            { round: "post", groupKey: "2", opensAt: at(2 * HOUR) },
            { round: "post", groupKey: "1", opensAt: at(0), closesAt: at(2 * HOUR) },
          ],
        }),
        ctx()
      )
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/กลุ่ม 1/)
      const rows = await grid()
      expect(row(rows, "1").windows.post.opensAt).toBeNull()
      expect(row(rows, "2").windows.post.opensAt).toBeNull()
    })

    it("allows Pre and Post of different Groups to overlap, and Post to start as Pre closes", async () => {
      const pivot = at(HOUR)
      const res = await PUT(
        req("PUT", {
          windows: [
            { round: "pre", groupKey: "1", opensAt: at(-HOUR), closesAt: pivot },
            { round: "post", groupKey: "1", opensAt: pivot, closesAt: at(2 * HOUR) },
            { round: "post", groupKey: "2", opensAt: at(-HOUR), closesAt: at(2 * HOUR) },
          ],
        }),
        ctx()
      )
      expect(res.status).toBe(200)
    })

    it.each([
      ["no windows", { windows: [] }],
      ["an unknown round", { windows: [{ round: "mid", groupKey: "1", opensAt: "now" }] }],
      ["a Group not in the roster", { windows: [{ round: "pre", groupKey: "9", opensAt: "now" }] }],
      ["a bad date", { windows: [{ round: "pre", groupKey: "1", opensAt: "tomorrow" }] }],
      ["a close before the open", { windows: [{ round: "pre", groupKey: "1", opensAt: at(HOUR), closesAt: at(0) }] }],
      ["the same slot twice", { windows: [{ round: "pre", groupKey: "1", opensAt: "now" }, { round: "pre", groupKey: "1", opensAt: null }] }],
    ])("400s on %s", async (_label, body) => {
      expect((await PUT(req("PUT", body), ctx())).status).toBe(400)
    })

    it("is manage-only: TA 403", async () => {
      const res = await PUT(req("PUT", { windows: [{ round: "pre", groupKey: "1", opensAt: "now" }] }, f.ta.email), ctx())
      expect(res.status).toBe(403)
    })
  })
})
