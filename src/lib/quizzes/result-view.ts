// What a Student is shown of a Quiz and of their own Quiz Attempts (#92/#93,
// ADR 0011). The one place that decides what of the answer key a Student sees:
// questions go out with no correct choice or explanation; a submitted attempt
// shows score and each question's outcome + topic. The key, explanations and
// Pre-vs-Post comparison are released only by `quizResultFor`.
import {
  isAttemptSubmitted,
  questionOutcome,
  scoreAttempt,
  type AttemptScore,
  type QuestionOutcome,
  type QuizAnswers,
} from "./attempt"
import type { AttemptRecord } from "./attempt-repository"
import type { QuizChoice } from "./import"
import type { QuizDetail } from "./repository"
import type { QuizRound, RoundWindowState } from "./round-window"
import type { WindowSlot } from "./windows"

export interface StudentQuizQuestion {
  id: number
  topic: string
  prompt: string
  code: string | null
  choices: QuizChoice[]
}

export interface StudentQuiz {
  id: number
  title: string
  description: string
  weekNo: number | null
  dontKnowEnabled: boolean
  questions: StudentQuizQuestion[]
}

export interface StudentAttempt {
  answers: QuizAnswers
  submitted: boolean
  submittedAt: string | null
  /** Only once submitted (by the Student or by the window closing). */
  result: AttemptScore | null
}

/** A question without its key — built field by field so nothing leaks by default. */
function questionForStudent(q: QuizDetail["questions"][number]): StudentQuizQuestion {
  return {
    id: q.id,
    topic: q.topic,
    prompt: q.prompt,
    code: q.code,
    choices: q.choices.map((c) => ({ letter: c.letter, text: c.text })),
  }
}

/** The Quiz without its key. */
export function quizForStudent(quiz: QuizDetail): StudentQuiz {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    weekNo: quiz.weekNo,
    dontKnowEnabled: quiz.dontKnowEnabled,
    questions: quiz.questions.map(questionForStudent),
  }
}

export function attemptForStudent(
  attempt: AttemptRecord,
  quiz: QuizDetail,
  windowState: RoundWindowState
): StudentAttempt {
  const submitted = isAttemptSubmitted(attempt, windowState)
  return {
    answers: attempt.answers,
    submitted,
    submittedAt: attempt.submittedAt,
    result: submitted ? scoreAttempt(quiz.questions, attempt.answers) : null,
  }
}

/** A round as a Student's list / Quiz page shows it: window + their own attempt. */
export interface StudentRoundSummary extends WindowSlot {
  attempt: { submitted: boolean; score: number | null; max: number } | null
}

export function roundSummaryForStudent(
  slot: WindowSlot,
  attempt: AttemptRecord | null,
  quiz: QuizDetail
): StudentRoundSummary {
  if (!attempt) return { ...slot, attempt: null }
  const view = attemptForStudent(attempt, quiz, slot.state)
  return {
    ...slot,
    attempt: { submitted: view.submitted, score: view.result?.score ?? null, max: quiz.questions.length },
  }
}

export interface RoundAnswer {
  answer: string | null
  outcome: QuestionOutcome
}

export interface QuizReviewQuestion extends StudentQuizQuestion {
  correctLetter: string
  feedback: string
  /** Null when that round wasn't taken (or isn't submitted yet). */
  pre: RoundAnswer | null
  post: RoundAnswer | null
}

export interface RoundScore {
  score: number
  max: number
}

export type QuizResult =
  | { released: false }
  | {
      released: true
      pre: RoundScore | null
      post: RoundScore | null
      questions: QuizReviewQuestion[]
    }

/**
 * Answer Key Release: staff always; a Student only once the **Post** window of
 * their Group has closed (whether or not they took it) — Pre and Post ask the
 * same questions, so an earlier key would leak into a still-open Post. Nor
 * while their Pre is open again (a make-up sitting after Post). Any other
 * state, including an unknown one, keeps it withheld (fails closed). Only
 * submitted attempts are compared.
 */
export function quizResultFor(
  viewer: { staff: boolean },
  quiz: QuizDetail,
  attempts: Record<QuizRound, StudentAttempt | null>,
  states: Partial<Record<QuizRound, RoundWindowState>>
): QuizResult {
  const released = viewer.staff || (states.post === "closed" && states.pre !== undefined && states.pre !== "open")
  if (!released) return { released: false }

  const submittedOnly = (a: StudentAttempt | null) => (a?.submitted ? a : null)
  const pre = submittedOnly(attempts.pre)
  const post = submittedOnly(attempts.post)
  const answerIn = (a: StudentAttempt | null, q: QuizDetail["questions"][number]): RoundAnswer | null => {
    if (!a) return null
    const answer = a.answers[String(q.id)]
    return { answer: answer ?? null, outcome: questionOutcome(q, answer) }
  }
  const total = (a: StudentAttempt | null): RoundScore | null =>
    a?.result ? { score: a.result.score, max: a.result.max } : null

  return {
    released: true,
    pre: total(pre),
    post: total(post),
    questions: quiz.questions.map((q) => ({
      ...questionForStudent(q),
      correctLetter: q.correctLetter,
      feedback: q.feedback,
      pre: answerIn(pre, q),
      post: answerIn(post, q),
    })),
  }
}
