import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, POST } from "./route"
import { POST as PREVIEW } from "./preview/route"
import { listWeeks } from "@/lib/weeks/repository"
import { createCourse } from "@/lib/courses/repository"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { listLogs } from "@/lib/logs"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import w01 from "@/lib/quizzes/fixtures/w01-pretest.json"

const small = {
  title: "Pre-test สัปดาห์ 2",
  description: "ไม่คิดคะแนน",
  questions: [
    {
      no: 1,
      topic: "Loop",
      prompt: "พิมพ์อะไร",
      code: "for (;;) {}",
      choices: [
        { letter: "A", text: "1", correct: true },
        { letter: "B", text: "2", correct: false },
      ],
      feedback: "เพราะ A",
    },
  ],
}

describe("/api/courses/[code]/[year]/[semester]/quizzes", () => {
  let f: CourseFixture

  function url(path = "") {
    return `http://localhost/api/courses/${f.course.code}/${f.course.year}/${f.course.semester}/quizzes${path}`
  }
  function req(method: string, body?: unknown, email = f.ins.email, path = ""): NextRequest {
    const r = new NextRequest(url(path), {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    r.cookies.set("session", sessionFor(email))
    return r
  }
  const ctx = () => ({
    params: Promise.resolve({
      code: f.course.code,
      year: String(f.course.year),
      semester: String(f.course.semester),
    }),
  })

  async function student() {
    const s = await createUser(f.db, { email: "s@kmitl.ac.th", name: "S" })
    await assignRole(f.db, s.id, "Student")
    await createEnrollment(f.db, {
      courseCode: f.course.code,
      courseYear: f.course.year,
      courseSemester: f.course.semester,
      userId: s.id,
    })
    return s
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
  })
  afterEach(() => setTestDb(null))

  describe("POST (create from import)", () => {
    it("imports the Week 1 Pre-test, Don't Know on by default, and logs it", async () => {
      const res = await POST(req("POST", { data: w01 }), ctx())
      expect(res.status).toBe(201)
      const { quiz } = await res.json()
      expect(quiz.title).toBe("Pre-test: พื้นฐานภาษา C ก่อนเรียน OOP ด้วย C++")
      expect(quiz.dontKnowEnabled).toBe(true)
      expect(quiz.weekId).toBeNull()
      expect(quiz.questions).toHaveLength(15)
      expect(quiz.questions[0]).toMatchObject({ topic: "Pointer พื้นฐาน", correctLetter: "D" })

      const { logs } = await listLogs(f.db, { action: "quiz.create", page: 1, pageSize: 50 })
      expect(logs).toHaveLength(1)
    })

    it("ties the Quiz to a Week of this course and honours dontKnowEnabled", async () => {
      const [, week2] = await listWeeks(f.db, f.course)
      const res = await POST(req("POST", { data: small, weekId: week2.id, dontKnowEnabled: false }), ctx())
      expect(res.status).toBe(201)
      const { quiz } = await res.json()
      expect(quiz).toMatchObject({ weekId: week2.id, weekNo: 2, dontKnowEnabled: false })
    })

    it("rejects a Week of another course (cf. #88)", async () => {
      const other = await createCourse(f.db, { code: "C99", year: 2567, semester: 1, nameTh: "อื่น", nameEn: "O" })
      const { seedWeeks } = await import("@/lib/weeks/repository")
      await seedWeeks(f.db, other)
      const [foreign] = await listWeeks(f.db, other)
      const res = await POST(req("POST", { data: small, weekId: foreign.id }), ctx())
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/สัปดาห์/)
    })

    it("returns every per-question import error and saves nothing", async () => {
      const bad = { ...small, questions: [{ ...small.questions[0], no: 4, prompt: "" }] }
      const res = await POST(req("POST", { data: bad }), ctx())
      expect(res.status).toBe(400)
      expect((await res.json()).errors).toEqual(["ข้อ 4: ต้องมีโจทย์ (prompt)"])
      const list = await (await GET(req("GET"), ctx())).json()
      expect(list.quizzes).toEqual([])
    })

    it.each([
      ["a wrong-typed weekId", { weekId: "2" }],
      ["a wrong-typed dontKnowEnabled", { dontKnowEnabled: "yes" }],
    ])("400s on %s", async (_label, extra) => {
      const res = await POST(req("POST", { data: small, ...extra }), ctx())
      expect(res.status).toBe(400)
    })

    it("is manage-only: TA 403, Student 403", async () => {
      expect((await POST(req("POST", { data: small }, f.ta.email), ctx())).status).toBe(403)
      const s = await student()
      expect((await POST(req("POST", { data: small }, s.email), ctx())).status).toBe(403)
    })
  })

  describe("POST /preview", () => {
    it("parses without saving and returns notices", async () => {
      const res = await PREVIEW(req("POST", { data: w01 }, f.ins.email, "/preview"), ctx())
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.draft.questions).toHaveLength(15)
      expect(body.notices).toEqual(["ข้ามส่วน background (แบบสำรวจไม่คิดคะแนน) 4 ข้อ"])
      const list = await (await GET(req("GET"), ctx())).json()
      expect(list.quizzes).toEqual([])
    })

    it("returns import errors as 400", async () => {
      const res = await PREVIEW(req("POST", { data: { title: "" } }, f.ins.email, "/preview"), ctx())
      expect(res.status).toBe(400)
      expect((await res.json()).errors).toEqual(["ต้องมี title"])
    })

    it("is manage-only", async () => {
      const res = await PREVIEW(req("POST", { data: small }, f.ta.email, "/preview"), ctx())
      expect(res.status).toBe(403)
    })
  })

  describe("GET (list)", () => {
    it("lists the course's quizzes with question counts for staff, TA included", async () => {
      await POST(req("POST", { data: w01 }), ctx())
      await POST(req("POST", { data: small }), ctx())
      const res = await GET(req("GET", undefined, f.ta.email), ctx())
      expect(res.status).toBe(200)
      const { quizzes } = await res.json()
      expect(quizzes.map((q: { title: string; questionCount: number }) => [q.title, q.questionCount])).toEqual([
        ["Pre-test: พื้นฐานภาษา C ก่อนเรียน OOP ด้วย C++", 15],
        ["Pre-test สัปดาห์ 2", 1],
      ])
    })

    it("does not list another course's quizzes", async () => {
      await POST(req("POST", { data: small }), ctx())
      const other = await createCourse(f.db, { code: "C99", year: 2567, semester: 1, nameTh: "อื่น", nameEn: "O" })
      const { assignInstructor } = await import("@/lib/courses/repository")
      await assignInstructor(f.db, other, f.ins.id)
      const r = new NextRequest("http://localhost/api/courses/C99/2567/1/quizzes")
      r.cookies.set("session", sessionFor(f.ins.email))
      const res = await GET(r, { params: Promise.resolve({ code: "C99", year: "2567", semester: "1" }) })
      expect((await res.json()).quizzes).toEqual([])
    })

    it("rejects students (until the student slice) and unlinked users", async () => {
      const s = await student()
      expect((await GET(req("GET", undefined, s.email), ctx())).status).toBe(403)
      const stranger = await createUser(f.db, { email: "x@kmitl.ac.th", name: "X" })
      await assignRole(f.db, stranger.id, "Instructor")
      expect((await GET(req("GET", undefined, stranger.email), ctx())).status).toBe(403)
    })

    it("401 without a session", async () => {
      const r = new NextRequest(url())
      expect((await GET(r, ctx())).status).toBe(401)
    })
  })
})
