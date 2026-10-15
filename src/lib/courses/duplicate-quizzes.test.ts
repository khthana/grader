import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { courseFixture, setTestDb } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import { getWeekByNo } from "@/lib/weeks/repository"
import { createQuiz, getQuizForCourse, listQuizzes } from "@/lib/quizzes/repository"
import { listWindows } from "@/lib/quizzes/windows"
import { getOrStartAttempt, isQuizLocked, lockedQuizIds } from "@/lib/quizzes/attempt-repository"
import { seedQuiz, seedStudent, setWindow } from "@/lib/test-support/quiz"
import { duplicateCourseOffering } from "./duplicate"
import { NextRequest } from "next/server"
import { sessionFor } from "@/lib/test-support/db"
import { PUT as PUT_QUIZ } from "@/app/api/courses/[code]/[year]/[semester]/quizzes/[qid]/route"

// Course duplication copies Quizzes (#95, ADR 0006 / 0011).
describe("duplicateCourseOffering — Quizzes", () => {
  let f: CourseFixture
  const target = () => ({ code: f.course.code, year: f.course.year, semester: 2 })
  const duplicate = () => duplicateCourseOffering(f.db, f.course, { year: target().year, semester: target().semester }, f.ins.id)

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
  })
  afterEach(() => setTestDb(null))

  async function seedSourceQuizzes() {
    const week2 = (await getWeekByNo(f.db, f.course, 2))!
    const unbound = await seedQuiz(f.db, f.course, { dontKnowEnabled: false })
    const bound = await createQuiz(f.db, f.course, {
      title: "Post W2",
      description: "สัปดาห์ 2",
      weekId: week2.id,
      dontKnowEnabled: true,
      questions: [
        {
          topic: "Loop",
          prompt: "ข้อหนึ่ง",
          code: "for i in range(3):\n  print(i)",
          choices: [
            { letter: "A", text: "0 1 2" },
            { letter: "B", text: "1 2 3" },
          ],
          correctLetter: "A",
          feedback: "range เริ่มที่ 0",
        },
        {
          topic: "Array",
          prompt: "ข้อสอง",
          code: null,
          choices: [
            { letter: "A", text: "x" },
            { letter: "B", text: "y" },
            { letter: "C", text: "z" },
          ],
          correctLetter: "C",
          feedback: "",
        },
      ],
    })
    return { unbound, bound }
  }

  /** The questions without their ids (a copy gets new ones). */
  const strip = ({ questions }: { questions: { id: number }[] }) =>
    questions.map((q) => Object.fromEntries(Object.entries(q).filter(([k]) => k !== "id")))

  it("copies every Quiz with its questions 1:1 in order — key, explanation and ไม่ทราบ setting", async () => {
    const { unbound, bound } = await seedSourceQuizzes()
    expect((await duplicate()).ok).toBe(true)

    const copies = await listQuizzes(f.db, target())
    expect(copies.map((q) => q.title)).toEqual([unbound.title, bound.title])
    for (const [source, copy] of [unbound, bound].map((s, i) => [s, copies[i]] as const)) {
      const detail = (await getQuizForCourse(f.db, target(), copy.id))!
      expect(detail).toMatchObject({
        title: source.title,
        description: source.description,
        dontKnowEnabled: source.dontKnowEnabled,
        weekNo: source.weekNo,
      })
      expect(strip(detail)).toEqual(strip(source))
    }
  })

  it("binds a copied Quiz to the target Week of the same number; an unbound Quiz stays unbound", async () => {
    await seedSourceQuizzes()
    await duplicate()

    const [unbound, bound] = await listQuizzes(f.db, target())
    expect(unbound.weekId).toBeNull()
    expect(bound.weekId).toBe((await getWeekByNo(f.db, target(), 2))!.id)
  })

  it("copies no Round Windows or Attempts — the copies are unlocked", async () => {
    const { unbound } = await seedSourceQuizzes()
    const student = await seedStudent(f.db, f.course, "1")
    await setWindow(f.db, unbound.id, "pre", "1", "open")
    await getOrStartAttempt(f.db, unbound.id, "pre", student.id)
    expect(await isQuizLocked(f.db, unbound.id)).toBe(true)

    await duplicate()

    const copies = await listQuizzes(f.db, target())
    expect((await lockedQuizIds(f.db, target())).size).toBe(0)
    for (const q of copies) expect(await listWindows(f.db, q.id)).toEqual([])
  })

  it("a copied Quiz takes a re-import (no 409), even though its source is locked", async () => {
    const { unbound } = await seedSourceQuizzes()
    const student = await seedStudent(f.db, f.course, "1")
    await getOrStartAttempt(f.db, unbound.id, "pre", student.id)
    await duplicate()

    const copy = (await listQuizzes(f.db, target()))[0]
    const t = target()
    const r = new NextRequest("http://localhost/api/x", {
      method: "PUT",
      body: JSON.stringify({
        data: { title: "T", questions: [{ no: 1, prompt: "p", choices: [{ letter: "A", text: "x", correct: true }, { letter: "B", text: "y" }] }] },
      }),
    })
    r.cookies.set("session", sessionFor(f.ins.email))
    const res = await PUT_QUIZ(r, {
      params: Promise.resolve({ code: t.code, year: String(t.year), semester: String(t.semester), qid: String(copy.id) }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).quiz.questions).toHaveLength(1)
  })
})
