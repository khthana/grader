import { describe, it, expect } from "vitest"
import { attemptForStudent, quizForStudent, quizResultFor, roundSummaryForStudent } from "./result-view"
import type { AttemptRecord } from "./attempt-repository"
import type { QuizDetail } from "./repository"
import type { WindowSlot } from "./windows"

const QUIZ: QuizDetail = {
  id: 1,
  courseCode: "C01",
  courseYear: 2567,
  courseSemester: 1,
  weekId: null,
  weekNo: null,
  title: "Pre W1",
  description: "",
  dontKnowEnabled: true,
  questionCount: 2,
  createdAt: "2026-10-01T00:00:00.000Z",
  questions: [
    { id: 11, topic: "Loop", prompt: "p1", code: "x", choices: [{ letter: "A", text: "a" }, { letter: "B", text: "b" }], correctLetter: "A", feedback: "เพราะ A" },
    { id: 12, topic: "Array", prompt: "p2", code: null, choices: [{ letter: "A", text: "a" }, { letter: "B", text: "b" }], correctLetter: "B", feedback: "เพราะ B" },
  ],
}

const attempt = (submittedAt: string | null): AttemptRecord => ({
  id: 1,
  quizId: 1,
  round: "pre",
  userId: 7,
  answers: { "11": "A", "12": "dont-know" },
  startedAt: "2026-10-20T09:00:00.000Z",
  updatedAt: "2026-10-20T09:05:00.000Z",
  submittedAt,
})

const slot = (state: WindowSlot["state"]): WindowSlot => ({ opensAt: null, closesAt: null, state })

describe("quizForStudent", () => {
  it("drops the correct choice and the explanation", () => {
    const view = quizForStudent(QUIZ)
    expect(view.questions[0]).toEqual({
      id: 11,
      topic: "Loop",
      prompt: "p1",
      code: "x",
      choices: [{ letter: "A", text: "a" }, { letter: "B", text: "b" }],
    })
    const raw = JSON.stringify(view)
    expect(raw).not.toContain("correctLetter")
    expect(raw).not.toContain("เพราะ")
  })
})

describe("attemptForStudent / roundSummaryForStudent", () => {
  it.each([
    ["in progress, window open", null, "open", false],
    ["submitted by the Student", "2026-10-20T09:10:00.000Z", "open", true],
    ["auto-submitted by the window closing", null, "closed", true],
  ] as const)("%s", (_label, submittedAt, state, submitted) => {
    const view = attemptForStudent(attempt(submittedAt), QUIZ, state)
    expect(view.submitted).toBe(submitted)
    expect(view.result).toEqual(
      submitted
        ? {
            score: 1,
            max: 2,
            outcomes: [
              { questionId: 11, topic: "Loop", outcome: "correct" },
              { questionId: 12, topic: "Array", outcome: "dont-know" },
            ],
          }
        : null
    )
    expect(JSON.stringify(view)).not.toContain("correctLetter")

    expect(roundSummaryForStudent(slot(state), attempt(submittedAt), QUIZ).attempt).toEqual({
      submitted,
      score: submitted ? 1 : null,
      max: 2,
    })
  })

  it("a round with no attempt has no attempt summary", () => {
    expect(roundSummaryForStudent(slot("closed"), null, QUIZ)).toEqual({ ...slot("closed"), attempt: null })
  })
})

describe("quizResultFor (Answer Key Release)", () => {
  const submittedPre = attemptForStudent(attempt("2026-10-20T09:10:00.000Z"), QUIZ, "closed")
  const postAttempt = attemptForStudent(
    { ...attempt("2026-10-27T09:10:00.000Z"), round: "post", answers: { "11": "A", "12": "B" } },
    QUIZ,
    "closed"
  )
  const attempts = { pre: submittedPre, post: postAttempt }

  it.each([
    ["staff", true, "closed", "not-open", true],
    ["staff", true, "closed", "open", true],
    ["staff", true, "closed", "closed", true],
    ["student", false, "closed", "not-open", false],
    ["student", false, "closed", "open", false],
    ["student", false, "closed", "closed", true],
    ["student, Pre never opened", false, "not-open", "closed", true],
    ["student, Pre reopened after Post closed", false, "open", "closed", false],
    ["student, Post state unknown (fails closed)", false, "closed", undefined, false],
    ["student, Pre state unknown (fails closed)", false, undefined, "closed", false],
  ] as const)("%s: Pre %s, Post %s → released %s", (_label, staff, pre, post, released) => {
    const result = quizResultFor({ staff }, QUIZ, attempts, { pre, post })
    expect(result.released).toBe(released)
    const raw = JSON.stringify(result)
    if (!released) {
      expect(result).toEqual({ released: false })
      expect(raw).not.toContain("correctLetter")
      expect(raw).not.toContain("เพราะ")
    }
  })

  it("once released: the key, explanation and Pre vs Post per question", () => {
    const result = quizResultFor({ staff: false }, QUIZ, attempts, { pre: "closed", post: "closed" })
    expect(result).toEqual({
      released: true,
      pre: { score: 1, max: 2 },
      post: { score: 2, max: 2 },
      questions: [
        {
          id: 11, topic: "Loop", prompt: "p1", code: "x",
          choices: QUIZ.questions[0].choices, correctLetter: "A", feedback: "เพราะ A",
          pre: { answer: "A", outcome: "correct" }, post: { answer: "A", outcome: "correct" },
        },
        {
          id: 12, topic: "Array", prompt: "p2", code: null,
          choices: QUIZ.questions[1].choices, correctLetter: "B", feedback: "เพราะ B",
          pre: { answer: "dont-know", outcome: "dont-know" }, post: { answer: "B", outcome: "correct" },
        },
      ],
    })
  })

  it("a round the Student didn't take — or hasn't submitted — compares as absent", () => {
    const inProgress = attemptForStudent({ ...attempt(null), round: "post" }, QUIZ, "open")
    for (const post of [null, inProgress]) {
      const result = quizResultFor({ staff: false }, QUIZ, { pre: submittedPre, post }, { pre: "closed", post: "closed" })
      if (!result.released) throw new Error("expected released")
      expect(result.post).toBeNull()
      expect(result.questions[0].post).toBeNull()
    }
  })
})
