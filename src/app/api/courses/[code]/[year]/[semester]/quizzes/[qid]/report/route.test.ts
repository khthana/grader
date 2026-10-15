import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import * as XLSX from "xlsx"
import { GET } from "./route"
import { GET as EXPORT } from "./export/route"
import { GET as ATTEMPT } from "../attempts/[userId]/route"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import { seedQuiz, seedStudent, setWindow } from "@/lib/test-support/quiz"
import { getOrStartAttempt, saveAnswers, submitAttempt } from "@/lib/quizzes/attempt-repository"
import type { QuizDetail } from "@/lib/quizzes/repository"
import type { QuizRound } from "@/lib/quizzes/round-window"

describe("/api/courses/[code]/[year]/[semester]/quizzes/[qid]/report", () => {
  let f: CourseFixture
  let quiz: QuizDetail
  let s: { id: number; email: string; name: string }[]

  function req(email: string, query = "") {
    const r = new NextRequest(`http://localhost/api/x${query}`)
    r.cookies.set("session", sessionFor(email))
    return r
  }
  const base = (qid: string) => ({
    code: f.course.code,
    year: String(f.course.year),
    semester: String(f.course.semester),
    qid,
  })
  const params = (qid = String(quiz.id)) => ({ params: Promise.resolve(base(qid)) })
  const of = (userId: number | string) => ({
    params: Promise.resolve({ ...base(String(quiz.id)), userId: String(userId) }),
  })

  /** Answers by position (q1, q2, q3); missing = left blank. */
  async function take(userId: number, round: QuizRound, answers: string[], submit: boolean) {
    const a = await getOrStartAttempt(f.db, quiz.id, round, userId)
    const byId: Record<string, string> = {}
    answers.forEach((ans, i) => (byId[String(quiz.questions[i].id)] = ans))
    await saveAnswers(f.db, a.id, byId)
    if (submit) await submitAttempt(f.db, a.id)
  }

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    quiz = await seedQuiz(f.db, f.course) // keys A, B, C
    s = [
      await seedStudent(f.db, f.course, "1"),
      await seedStudent(f.db, f.course, "1"),
      await seedStudent(f.db, f.course, "2"),
      await seedStudent(f.db, f.course, "2"),
    ]
    await setWindow(f.db, quiz.id, "pre", "1", "closed")
    await setWindow(f.db, quiz.id, "post", "1", "open")
    await setWindow(f.db, quiz.id, "pre", "2", "closed")

    await take(s[0].id, "pre", ["A", "dont-know", "A"], true) // 1
    await take(s[0].id, "post", ["A", "B", "C"], true) // 3
    await take(s[1].id, "pre", ["B", "B", "C"], true) // 2
    await take(s[1].id, "post", ["A", "B", "C"], false) // in progress — not counted
    await take(s[2].id, "pre", ["A"], false) // auto-submitted by the window closing: 1
    // s[3] took nothing
  })
  afterEach(() => setTestDb(null))

  it("overview: submissions against the roster and average scores, submitted attempts only", async () => {
    const res = await GET(req(f.ins.email), params())
    expect(res.status).toBe(200)
    const { report } = await res.json()
    expect(report.overview.enrolled).toBe(4)
    expect(report.overview.max).toBe(3)
    expect(report.overview.pre.submitted).toBe(3)
    expect(report.overview.pre.average).toBeCloseTo(4 / 3)
    expect(report.overview.post).toEqual({ submitted: 1, average: 3 })
    expect(report.groups.map((g: { key: string }) => g.key)).toEqual(["1", "2", ""])
  })

  it("per question: correct / wrong / ไม่ทราบ / ไม่ตอบ apart, and each choice's count", async () => {
    const { report } = await (await GET(req(f.ins.email), params())).json()
    const [q1, q2, q3] = report.questions
    expect(q1).toMatchObject({ no: 1, topic: "หัวข้อ 1", correctLetter: "A" })
    expect(q1.pre).toEqual({ correct: 2, wrong: 1, dontKnow: 0, unanswered: 0, choices: { A: 2, B: 1, C: 0 } })
    expect(q2.pre).toEqual({ correct: 1, wrong: 0, dontKnow: 1, unanswered: 1, choices: { A: 0, B: 1, C: 0 } })
    expect(q3.pre).toEqual({ correct: 1, wrong: 1, dontKnow: 0, unanswered: 1, choices: { A: 1, B: 0, C: 1 } })
    expect(q1.post).toEqual({ correct: 1, wrong: 0, dontKnow: 0, unanswered: 0, choices: { A: 1, B: 0, C: 0 } })
  })

  it("per student: Pre, Post and Post − Pre only for those who did both", async () => {
    const { report } = await (await GET(req(f.ins.email), params())).json()
    const byId = new Map(report.students.map((r: { userId: number }) => [r.userId, r]))
    expect(byId.get(s[0].id)).toMatchObject({ groupKey: "1", pre: 1, post: 3, diff: 2 })
    expect(byId.get(s[1].id)).toMatchObject({ pre: 2, post: null, diff: null })
    expect(byId.get(s[2].id)).toMatchObject({ groupKey: "2", pre: 1, post: null, diff: null })
    expect(byId.get(s[3].id)).toMatchObject({ pre: null, post: null, diff: null })
  })

  it("filters by Group", async () => {
    const { report } = await (await GET(req(f.ins.email, "?group=2"), params())).json()
    expect(report.group).toBe("2")
    expect(report.overview).toMatchObject({
      enrolled: 2,
      pre: { submitted: 1, average: 1 },
      post: { submitted: 0, average: null },
    })
    expect(report.students.map((r: { userId: number }) => r.userId).sort()).toEqual([s[2].id, s[3].id].sort())
    expect(report.questions[0].pre.correct).toBe(1)
  })

  it("exports students and questions to Excel", async () => {
    const res = await EXPORT(req(f.ins.email), params())
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("spreadsheetml")
    const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: "array" })
    expect(wb.SheetNames).toEqual(["รายคน", "รายข้อ"])
    const students = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["รายคน"])
    expect(students).toHaveLength(4)
    expect(students.find((r) => r["ชื่อ"] === s[0].name)).toMatchObject({
      กลุ่ม: "กลุ่ม 1",
      Pre: 1,
      Post: 3,
      "Post − Pre": 2,
    })
    const questions = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["รายข้อ"])
    expect(questions[1]).toMatchObject({
      ข้อ: 2,
      เฉลย: "B",
      "Pre-test ถูก": 1,
      "Pre-test ไม่ทราบ": 1,
      "Pre-test ไม่ตอบ": 1,
      "Pre-test เลือก B": 1,
    })
  })

  it("one Student's answers, Pre vs Post, with the key", async () => {
    const res = await ATTEMPT(req(f.ta.email), of(s[0].id))
    expect(res.status).toBe(200)
    const { result } = await res.json()
    expect(result).toMatchObject({ released: true, pre: { score: 1, max: 3 }, post: { score: 3, max: 3 } })
    expect(result.questions[1]).toMatchObject({
      correctLetter: "B",
      pre: { answer: "dont-know", outcome: "dont-know" },
      post: { answer: "B", outcome: "correct" },
    })
    // An in-progress Post is not shown as an answer.
    const other = await (await ATTEMPT(req(f.ins.email), of(s[1].id))).json()
    expect(other.result.post).toBeNull()
  })

  it("404s a user who isn't on the roster, and an unknown Quiz", async () => {
    expect((await ATTEMPT(req(f.ins.email), of(f.ta.id))).status).toBe(404)
    expect((await ATTEMPT(req(f.ins.email), of("x"))).status).toBe(404)
    expect((await GET(req(f.ins.email), params("999"))).status).toBe(404)
  })

  it("is for course staff only (TA may read) — not even a Student's own attempt", async () => {
    expect((await GET(req(f.ta.email), params())).status).toBe(200)
    expect((await EXPORT(req(f.ta.email), params())).status).toBe(200)
    expect((await GET(req(s[0].email), params())).status).toBe(403)
    expect((await EXPORT(req(s[0].email), params())).status).toBe(403)
    expect((await ATTEMPT(req(s[0].email), of(s[0].id))).status).toBe(403)
  })
})
