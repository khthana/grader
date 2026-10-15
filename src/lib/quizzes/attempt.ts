// Quiz Attempt rules (#92, ADR 0011) — pure. When an attempt counts as
// submitted, how it scores, and how a Student's saved answers change.
import type { QuizChoice } from "./import"
import type { RoundWindowState } from "./round-window"

/** The stored answer for "ไม่ทราบ" — scores 0 but is reported apart from wrong. */
export const DONT_KNOW = "dont-know"

/** questionId (as a JSON key) → choice letter | DONT_KNOW. */
export type QuizAnswers = Record<string, string>

export type QuestionOutcome = "correct" | "wrong" | "dont-know" | "unanswered"

/** What scoring needs of a question. */
export interface AttemptQuestion {
  id: number
  topic: string
  choices: QuizChoice[]
  correctLetter: string
}

export interface QuestionResult {
  questionId: number
  topic: string
  outcome: QuestionOutcome
}

export interface AttemptScore {
  score: number
  max: number
  outcomes: QuestionResult[]
}

/**
 * Submitted when the Student submitted it, or — automatically, derived on read —
 * once their Group's Round Window has closed. No scheduled job.
 */
export function isAttemptSubmitted(
  attempt: { submittedAt: string | Date | null },
  windowState: RoundWindowState
): boolean {
  return attempt.submittedAt !== null || windowState === "closed"
}

export function questionOutcome(question: AttemptQuestion, answer: string | undefined): QuestionOutcome {
  if (answer === undefined) return "unanswered"
  if (answer === DONT_KNOW) return "dont-know"
  return answer === question.correctLetter ? "correct" : "wrong"
}

/** 1 per correct answer; ไม่ทราบ, wrong and unanswered all score 0. */
export function scoreAttempt(questions: AttemptQuestion[], answers: QuizAnswers): AttemptScore {
  const outcomes = questions.map((q) => ({
    questionId: q.id,
    topic: q.topic,
    outcome: questionOutcome(q, answers[String(q.id)]),
  }))
  return {
    score: outcomes.filter((o) => o.outcome === "correct").length,
    max: questions.length,
    outcomes,
  }
}

/** Questions with no answer yet — ไม่ทราบ counts as an answer. */
export function unansweredCount(questions: { id: number }[], answers: QuizAnswers): number {
  return questions.filter((q) => answers[String(q.id)] === undefined).length
}

/**
 * Apply a Student's answer patch (`{ questionId: letter | "dont-know" | null }`,
 * null clears) over their saved answers. Every answer must name a question of
 * this Quiz and one of its choices (or ไม่ทราบ when the Quiz offers it).
 */
export function mergeAnswers(
  saved: QuizAnswers,
  patch: unknown,
  ctx: { questions: AttemptQuestion[]; dontKnowEnabled: boolean }
): { ok: true; answers: QuizAnswers } | { ok: false; error: string } {
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
    return { ok: false, error: "คำตอบไม่ถูกต้อง" }
  }
  const byId = new Map(ctx.questions.map((q) => [String(q.id), q]))
  const answers = { ...saved }
  for (const [questionId, answer] of Object.entries(patch)) {
    const question = byId.get(questionId)
    if (!question) return { ok: false, error: "ไม่พบข้อนี้ในแบบทดสอบ" }
    if (answer === null) {
      delete answers[questionId]
      continue
    }
    const valid =
      typeof answer === "string" &&
      (answer === DONT_KNOW ? ctx.dontKnowEnabled : question.choices.some((c) => c.letter === answer))
    if (!valid) return { ok: false, error: "ตัวเลือกไม่ถูกต้อง" }
    answers[questionId] = answer
  }
  return { ok: true, answers }
}
