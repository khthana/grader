import { describe, it, expect } from "vitest"
import { attemptForStudent, quizForStudent, roundSummaryForStudent } from "./result-view"
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
