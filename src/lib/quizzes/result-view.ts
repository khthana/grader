// What a Student is shown of a Quiz and of their own Quiz Attempts (#92, ADR
// 0011). The one place the answer key is withheld: questions go out with no
// correct choice and no explanation; a submitted attempt shows score and each
// question's outcome + topic, never the key (Answer Key Release is #93).
import { isAttemptSubmitted, scoreAttempt, type AttemptScore, type QuizAnswers } from "./attempt"
import type { AttemptRecord } from "./attempt-repository"
import type { QuizChoice } from "./import"
import type { QuizDetail } from "./repository"
import type { RoundWindowState } from "./round-window"
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

/** The Quiz without its key — built field by field so nothing leaks by default. */
export function quizForStudent(quiz: QuizDetail): StudentQuiz {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    weekNo: quiz.weekNo,
    dontKnowEnabled: quiz.dontKnowEnabled,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      topic: q.topic,
      prompt: q.prompt,
      code: q.code,
      choices: q.choices.map((c) => ({ letter: c.letter, text: c.text })),
    })),
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
