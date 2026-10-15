import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, PUT, DELETE } from "./route"
import { listWeeks, seedWeeks } from "@/lib/weeks/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { listLogs } from "@/lib/logs"
import { createQuiz } from "@/lib/quizzes/repository"
import { parseQuizImport, type QuizQuestionDraft } from "@/lib/quizzes/import"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import type { CourseKey } from "@/lib/courses/types"
import w01 from "@/lib/quizzes/fixtures/w01-pretest.json"

const W01 = (() => {
  const r = parseQuizImport(w01)
  if (!r.ok) throw new Error("fixture")
  return r.draft
})()

function q(prompt: string, correct = "A"): QuizQuestionDraft {
  return {
    topic: "t",
    prompt,
    code: null,
    choices: [
      { letter: "A", text: "a" },
      { letter: "B", text: "b" },
    ],
    correctLetter: correct,
    feedback: "",
  }
}

describe("/api/courses/[code]/[year]/[semester]/quizzes/[qid]", () => {
  let f: CourseFixture
  let quizId: number

  function req(method: string, body?: unknown, email = f.ins.email, key: CourseKey = f.course, id = quizId) {
    const r = new NextRequest(
      `http://localhost/api/courses/${key.code}/${key.year}/${key.semester}/quizzes/${id}`,
      { method, body: body === undefined ? undefined : JSON.stringify(body) }
    )
    r.cookies.set("session", sessionFor(email))
    return r
  }
  const ctx = (id: number | string = quizId, key: CourseKey = f.course) => ({
    params: Promise.resolve({
      code: key.code,
      year: String(key.year),
      semester: String(key.semester),
      qid: String(id),
    }),
  })

  async function create(key: CourseKey = f.course) {
    return createQuiz(f.db, key, {
      title: W01.title,
      description: W01.description,
      weekId: null,
      dontKnowEnabled: true,
      questions: W01.questions,
    })
  }

  async function logged(action: string) {
    return (await listLogs(f.db, { action, page: 1, pageSize: 50 })).logs.length
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    quizId = (await create()).id
  })
  afterEach(() => setTestDb(null))

  describe("GET", () => {
    it("returns the Quiz with its questions, answer key included, to staff (TA too)", async () => {
      const res = await GET(req("GET", undefined, f.ta.email), ctx())
      expect(res.status).toBe(200)
      const { quiz } = await res.json()
      expect(quiz.title).toBe(W01.title)
      expect(quiz.questions).toHaveLength(15)
      expect(quiz.questions[6]).toMatchObject({ topic: "Buffer overflow", correctLetter: "D" })
    })

    it("404s an unknown id, a non-numeric id, and another course's Quiz", async () => {
      expect((await GET(req("GET"), ctx(99999))).status).toBe(404)
      expect((await GET(req("GET"), ctx("abc"))).status).toBe(404)

      const other = await createCourse(f.db, { code: "C99", year: 2567, semester: 1, nameTh: "อื่น", nameEn: "O" })
      const foreign = await create(other)
      expect((await GET(req("GET"), ctx(foreign.id))).status).toBe(404)
    })

    it("rejects an enrolled student (until the student slice)", async () => {
      const s = await createUser(f.db, { email: "s@kmitl.ac.th", name: "S" })
      await assignRole(f.db, s.id, "Student")
      await createEnrollment(f.db, {
        courseCode: f.course.code,
        courseYear: f.course.year,
        courseSemester: f.course.semester,
        userId: s.id,
      })
      expect((await GET(req("GET", undefined, s.email), ctx())).status).toBe(403)
    })
  })

  describe("PUT", () => {
    it("edits title, description, Week and Don't Know; omitted fields keep their value", async () => {
      const [, , week3] = await listWeeks(f.db, f.course)
      const res = await PUT(req("PUT", { title: "  Pre W1  ", weekId: week3.id, dontKnowEnabled: false }), ctx())
      expect(res.status).toBe(200)
      const { quiz } = await res.json()
      expect(quiz).toMatchObject({
        title: "Pre W1",
        description: W01.description,
        weekId: week3.id,
        weekNo: 3,
        dontKnowEnabled: false,
      })
      expect(quiz.questions).toHaveLength(15)
      expect(await logged("quiz.update")).toBe(1)
    })

    it("clears the Week with weekId: null", async () => {
      const [week1] = await listWeeks(f.db, f.course)
      await PUT(req("PUT", { weekId: week1.id }), ctx())
      const { quiz } = await (await PUT(req("PUT", { weekId: null }), ctx())).json()
      expect(quiz.weekId).toBeNull()
    })

    it("re-import replaces the questions only — title and settings stay", async () => {
      const data = {
        title: "ชื่อในไฟล์ใหม่",
        questions: [
          { no: 1, prompt: "ใหม่ 1", choices: [{ letter: "A", text: "x", correct: true }, { letter: "B", text: "y" }] },
          { no: 2, prompt: "ใหม่ 2", choices: [{ letter: "A", text: "x" }, { letter: "B", text: "y", correct: true }] },
        ],
      }
      const res = await PUT(req("PUT", { data }), ctx())
      expect(res.status).toBe(200)
      const { quiz } = await res.json()
      expect(quiz.title).toBe(W01.title)
      expect(quiz.questions.map((x: { prompt: string; correctLetter: string }) => [x.prompt, x.correctLetter])).toEqual([
        ["ใหม่ 1", "A"],
        ["ใหม่ 2", "B"],
      ])
    })

    it("a bad re-import returns its errors and leaves the questions untouched", async () => {
      const res = await PUT(req("PUT", { data: { title: "T", questions: [{ no: 3, prompt: "" }] } }), ctx())
      expect(res.status).toBe(400)
      expect((await res.json()).errors).toEqual(["ข้อ 3: ต้องมีโจทย์ (prompt)"])
      const { quiz } = await (await GET(req("GET"), ctx())).json()
      expect(quiz.questions).toHaveLength(15)
    })

    it.each([
      ["a blank title", { title: "  " }],
      ["a wrong-typed weekId", { weekId: "1" }],
      ["a wrong-typed dontKnowEnabled", { dontKnowEnabled: 1 }],
    ])("400s on %s", async (_label, body) => {
      expect((await PUT(req("PUT", body), ctx())).status).toBe(400)
    })

    it("rejects a Week of another course", async () => {
      const other = await createCourse(f.db, { code: "C99", year: 2567, semester: 1, nameTh: "อื่น", nameEn: "O" })
      await seedWeeks(f.db, other)
      const [foreign] = await listWeeks(f.db, other)
      expect((await PUT(req("PUT", { weekId: foreign.id }), ctx())).status).toBe(400)
    })

    it("404s another course's Quiz even for its own instructor via this URL", async () => {
      const other = await createCourse(f.db, { code: "C99", year: 2567, semester: 1, nameTh: "อื่น", nameEn: "O" })
      await assignInstructor(f.db, other, f.ins.id)
      const foreign = await createQuiz(f.db, other, {
        title: "x", description: "", weekId: null, dontKnowEnabled: true, questions: [q("p")],
      })
      expect((await PUT(req("PUT", { title: "hijack" }), ctx(foreign.id))).status).toBe(404)
    })

    it("is manage-only: TA 403", async () => {
      expect((await PUT(req("PUT", { title: "x" }, f.ta.email), ctx())).status).toBe(403)
    })
  })

  describe("DELETE", () => {
    it("deletes the Quiz and logs it", async () => {
      const res = await DELETE(req("DELETE"), ctx())
      expect(res.status).toBe(200)
      expect((await GET(req("GET"), ctx())).status).toBe(404)
      expect(await logged("quiz.delete")).toBe(1)
    })

    it("404s an unknown id; TA 403", async () => {
      expect((await DELETE(req("DELETE"), ctx(99999))).status).toBe(404)
      expect((await DELETE(req("DELETE", undefined, f.ta.email), ctx())).status).toBe(403)
    })
  })
})
