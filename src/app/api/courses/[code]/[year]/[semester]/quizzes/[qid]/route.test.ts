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
import { seedStudent, setWindow } from "@/lib/test-support/quiz"
import { getOrStartAttempt, saveAnswers } from "@/lib/quizzes/attempt-repository"

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

  async function enrolledStudent() {
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

    it("tells staff whether the Quiz is locked", async () => {
      expect((await (await GET(req("GET"), ctx())).json()).quiz.locked).toBe(false)
      const s = await seedStudent(f.db, f.course, null)
      await getOrStartAttempt(f.db, quizId, "pre", s.id)
      expect((await (await GET(req("GET"), ctx())).json()).quiz.locked).toBe(true)
    })

    it("rejects an unlinked instructor", async () => {
      const stranger = await createUser(f.db, { email: "x@kmitl.ac.th", name: "X" })
      await assignRole(f.db, stranger.id, "Instructor")
      expect((await GET(req("GET", undefined, stranger.email), ctx())).status).toBe(403)
    })
  })

  describe("GET — Students", () => {
    it("404s, like an unknown id, until a round opens for the Student's Group", async () => {
      const s = await seedStudent(f.db, f.course, "1")
      await setWindow(f.db, quizId, "pre", "2", "open")
      expect((await GET(req("GET", undefined, s.email), ctx())).status).toBe(404)
      await setWindow(f.db, quizId, "pre", "1", "not-open")
      expect((await GET(req("GET", undefined, s.email), ctx())).status).toBe(404)
    })

    it("returns the questions without the key, and each round's state and own attempt", async () => {
      const s = await seedStudent(f.db, f.course, "1")
      await setWindow(f.db, quizId, "pre", "1", "open")
      const res = await GET(req("GET", undefined, s.email), ctx())
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.quiz.questions).toHaveLength(15)
      expect(body.rounds.pre).toMatchObject({ state: "open", attempt: null })
      expect(body.rounds.post).toMatchObject({ state: "not-open", attempt: null })
      const raw = JSON.stringify(body)
      expect(raw).not.toContain("correctLetter")
      expect(raw).not.toContain("feedback")
      expect(body.quiz).not.toHaveProperty("locked")
    })

    it("reports the Student's own attempt per round", async () => {
      const s = await seedStudent(f.db, f.course, "1")
      await setWindow(f.db, quizId, "pre", "1", "closed")
      await getOrStartAttempt(f.db, quizId, "pre", s.id)
      const { rounds } = await (await GET(req("GET", undefined, s.email), ctx())).json()
      expect(rounds.pre.attempt).toEqual({ submitted: true, score: 0, max: 15 })
      expect(rounds.post.attempt).toBeNull()
    })

    describe("Answer Key Release", () => {
      const leaksKey = (body: unknown) => {
        const raw = JSON.stringify(body)
        return raw.includes("correctLetter") || raw.includes("feedback")
      }

      async function preTaken() {
        const s = await seedStudent(f.db, f.course, "1")
        await setWindow(f.db, quizId, "pre", "1", "open")
        const a = await getOrStartAttempt(f.db, quizId, "pre", s.id)
        const { quiz } = await (await GET(req("GET"), ctx())).json()
        await saveAnswers(f.db, a.id, { [quiz.questions[0].id]: quiz.questions[0].correctLetter })
        await setWindow(f.db, quizId, "pre", "1", "closed")
        return s
      }
      const view = async (email: string) => (await GET(req("GET", undefined, email), ctx())).json()

      it("withholds the key while the Group's Post isn't set, not open yet, or open", async () => {
        const s = await preTaken()
        for (const phase of [null, "not-open", "open"] as const) {
          if (phase) await setWindow(f.db, quizId, "post", "1", phase)
          const body = await view(s.email)
          expect(body.result).toEqual({ released: false })
          expect(leaksKey(body)).toBe(false)
        }
      })

      it("withholds it when only another Group's Post has closed", async () => {
        const s = await preTaken()
        await setWindow(f.db, quizId, "post", "2", "closed")
        await setWindow(f.db, quizId, "post", "1", "open")
        expect(leaksKey(await view(s.email))).toBe(false)
      })

      it("releases key, explanations and Pre vs Post once the Group's Post closes — taken or not", async () => {
        const s = await preTaken()
        await setWindow(f.db, quizId, "post", "1", "closed")
        const { result } = await view(s.email)
        expect(result.released).toBe(true)
        expect(result.pre).toEqual({ score: 1, max: 15 })
        expect(result.post).toBeNull()
        expect(result.questions[0]).toMatchObject({
          correctLetter: W01.questions[0].correctLetter,
          feedback: W01.questions[0].feedback,
          pre: { outcome: "correct" },
          post: null,
        })
        expect(result.questions[1].pre).toEqual({ answer: null, outcome: "unanswered" })
      })
    })

    it("403s a student who isn't linked to this course", async () => {
      const outsider = await createUser(f.db, { email: "o@kmitl.ac.th", name: "O" })
      await assignRole(f.db, outsider.id, "Student")
      expect((await GET(req("GET", undefined, outsider.email), ctx())).status).toBe(403)
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

    it("once locked, refuses a re-import (409) but still edits the metadata", async () => {
      const s = await seedStudent(f.db, f.course, null)
      await getOrStartAttempt(f.db, quizId, "pre", s.id)
      const data = { title: "T", questions: [{ no: 1, prompt: "p", choices: [{ letter: "A", text: "x", correct: true }, { letter: "B", text: "y" }] }] }
      expect((await PUT(req("PUT", { data }), ctx())).status).toBe(409)
      const { quiz } = await (await GET(req("GET"), ctx())).json()
      expect(quiz.questions).toHaveLength(15)

      const res = await PUT(req("PUT", { title: "ชื่อใหม่" }), ctx())
      expect(res.status).toBe(200)
      expect((await res.json()).quiz).toMatchObject({ title: "ชื่อใหม่", locked: true })
    })
  })

  describe("DELETE", () => {
    it("deletes the Quiz and logs it", async () => {
      const res = await DELETE(req("DELETE"), ctx())
      expect(res.status).toBe(200)
      expect((await GET(req("GET"), ctx())).status).toBe(404)
      expect(await logged("quiz.delete")).toBe(1)
    })

    it("404s an unknown id; TA and Student 403", async () => {
      expect((await DELETE(req("DELETE"), ctx(99999))).status).toBe(404)
      expect((await DELETE(req("DELETE", undefined, f.ta.email), ctx())).status).toBe(403)
      const s = await enrolledStudent()
      expect((await DELETE(req("DELETE", undefined, s.email), ctx())).status).toBe(403)
    })
  })
})
