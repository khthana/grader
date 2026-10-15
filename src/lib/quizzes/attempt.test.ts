import { describe, it, expect } from "vitest"
import {
  DONT_KNOW,
  isAttemptSubmitted,
  mergeAnswers,
  questionOutcome,
  scoreAttempt,
  unansweredCount,
  type AttemptQuestion,
} from "./attempt"

const q = (id: number, correctLetter: string, topic = `t${id}`): AttemptQuestion => ({
  id,
  topic,
  choices: [
    { letter: "A", text: "a" },
    { letter: "B", text: "b" },
    { letter: "C", text: "c" },
  ],
  correctLetter,
})
const QUESTIONS = [q(1, "A"), q(2, "B"), q(3, "C"), q(4, "A")]

describe("isAttemptSubmitted", () => {
  it.each([
    ["submitted by the Student, window still open", "2026-10-20T09:00:00Z", "open", true],
    ["not submitted, window open", null, "open", false],
    ["not submitted, window closed → auto-submitted", null, "closed", true],
    ["submitted, window closed", "2026-10-20T09:00:00Z", "closed", true],
  ] as const)("%s", (_label, submittedAt, state, expected) => {
    expect(isAttemptSubmitted({ submittedAt }, state)).toBe(expected)
  })
})

describe("questionOutcome", () => {
  it.each([
    ["the correct letter", "A", "correct"],
    ["another letter", "B", "wrong"],
    ["ไม่ทราบ", DONT_KNOW, "dont-know"],
    ["no answer", undefined, "unanswered"],
  ])("%s → %s", (_label, answer, expected) => {
    expect(questionOutcome(q(1, "A"), answer)).toBe(expected)
  })
})

describe("scoreAttempt", () => {
  it("scores 1 per correct answer; ไม่ทราบ, wrong and unanswered score 0", () => {
    const result = scoreAttempt(QUESTIONS, { "1": "A", "2": "C", "3": DONT_KNOW })
    expect(result.score).toBe(1)
    expect(result.max).toBe(4)
    expect(result.outcomes).toEqual([
      { questionId: 1, topic: "t1", outcome: "correct" },
      { questionId: 2, topic: "t2", outcome: "wrong" },
      { questionId: 3, topic: "t3", outcome: "dont-know" },
      { questionId: 4, topic: "t4", outcome: "unanswered" },
    ])
  })

  it("ignores answers to questions that aren't in the Quiz", () => {
    expect(scoreAttempt(QUESTIONS, { "99": "A" }).score).toBe(0)
  })
})

describe("unansweredCount", () => {
  it("counts ไม่ทราบ as answered", () => {
    expect(unansweredCount(QUESTIONS, { "1": "A", "2": DONT_KNOW })).toBe(2)
    expect(unansweredCount(QUESTIONS, { "1": "A", "2": DONT_KNOW, "3": "B", "4": "C" })).toBe(0)
  })
})

describe("mergeAnswers", () => {
  const ctx = { questions: QUESTIONS, dontKnowEnabled: true }

  it("merges a partial patch over the saved answers; null clears one", () => {
    const r = mergeAnswers({ "1": "A", "2": "B" }, { "2": DONT_KNOW, "3": "C", "1": null }, ctx)
    expect(r).toEqual({ ok: true, answers: { "2": DONT_KNOW, "3": "C" } })
  })

  it.each([
    ["not an object", ["A"]],
    ["a question not in the Quiz", { "99": "A" }],
    ["a letter not among the choices", { "1": "Z" }],
    ["a non-string answer", { "1": 1 }],
  ])("refuses %s", (_label, patch) => {
    expect(mergeAnswers({}, patch, ctx).ok).toBe(false)
  })

  it("refuses ไม่ทราบ when the Quiz has it turned off", () => {
    expect(mergeAnswers({}, { "1": DONT_KNOW }, { ...ctx, dontKnowEnabled: false }).ok).toBe(false)
  })
})
