// Quiz visibility for Students (#92, ADR 0011): a Student sees a Quiz once
// either round's window for their *current* Group has opened (Week release is
// ignored). Anything else is "not found" — the same as an unknown id.
import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import { findEnrollment } from "@/lib/enrollments/repository"
import { findQuizForCourse } from "./route-helpers"
import { QUIZ_ROUNDS, type QuizRound } from "./round-window"
import { groupKeyOf, groupRoundWindows, listGroupWindows, listWindows, type WindowSlot } from "./windows"
import { getQuizForCourse, listQuizzes, type QuizDetail } from "./repository"
import { getAttempt, listAttemptsForUser, type AttemptRecord } from "./attempt-repository"
import { roundSummaryForStudent, type StudentRoundSummary } from "./result-view"

export type StudentRounds = Record<QuizRound, WindowSlot>

export interface StudentQuizAccess {
  quiz: QuizDetail
  groupKey: string
  rounds: StudentRounds
}

export const isQuizVisibleToStudent = (rounds: StudentRounds) =>
  QUIZ_ROUNDS.some((r) => rounds[r].state !== "not-open")

/** The Student's current Group key ('' = ไม่ระบุกลุ่ม), or null if not enrolled. */
export async function studentGroupKey(db: Queryable, course: CourseKey, userId: number): Promise<string | null> {
  const enrollment = await findEnrollment(db, course, userId)
  if (!enrollment) return null
  return groupKeyOf(enrollment.studyGroup)
}

/**
 * The Quiz named by `qid` as this Student may see it, with their Group's round
 * states at `now` — or null (not enrolled, unknown id, other course, or not
 * yet opened for their Group).
 */
export async function resolveStudentQuiz(
  db: Queryable,
  course: CourseKey,
  userId: number,
  qid: string,
  now: Date
): Promise<StudentQuizAccess | null> {
  const groupKey = await studentGroupKey(db, course, userId)
  if (groupKey === null) return null
  const quiz = await findQuizForCourse(db, course, qid)
  if (!quiz) return null
  const rounds = groupRoundWindows(await listWindows(db, quiz.id), groupKey, now)
  return isQuizVisibleToStudent(rounds) ? { quiz, groupKey, rounds } : null
}

export interface StudentQuizListItem {
  id: number
  title: string
  description: string
  weekNo: number | null
  questionCount: number
  rounds: Record<QuizRound, StudentRoundSummary>
}

/** The Quizzes this Student may see, each round with their own attempt summary. */
export async function listQuizzesForStudent(
  db: Queryable,
  course: CourseKey,
  userId: number,
  now: Date
): Promise<StudentQuizListItem[]> {
  const groupKey = await studentGroupKey(db, course, userId)
  if (groupKey === null) return []
  const windows = await listGroupWindows(db, course, groupKey)
  const attempts = await listAttemptsForUser(db, course, userId)

  const attemptOf = (quizId: number, round: QuizRound) =>
    attempts.find((a) => a.quizId === quizId && a.round === round) ?? null

  const items: StudentQuizListItem[] = []
  for (const record of await listQuizzes(db, course)) {
    const rounds = groupRoundWindows(windows.get(record.id) ?? [], groupKey, now)
    if (!isQuizVisibleToStudent(rounds)) continue
    // Scoring needs the questions — load them only for a Quiz the Student has attempted.
    const attempted = QUIZ_ROUNDS.some((r) => attemptOf(record.id, r))
    const quiz = attempted ? (await getQuizForCourse(db, course, record.id))! : { ...record, questions: [] }
    items.push({
      id: record.id,
      title: record.title,
      description: record.description,
      weekNo: record.weekNo,
      questionCount: record.questionCount,
      rounds: studentRoundSummaries(rounds, quiz, (round) => attemptOf(record.id, round)),
    })
  }
  return items
}

/** A visible Quiz's rounds for this Student, each with their own attempt. */
export async function studentRoundsWithAttempts(
  db: Queryable,
  access: StudentQuizAccess,
  userId: number
): Promise<Record<QuizRound, StudentRoundSummary>> {
  const attempts = new Map(
    await Promise.all(
      QUIZ_ROUNDS.map(async (r) => [r, await getAttempt(db, access.quiz.id, r, userId)] as const)
    )
  )
  return studentRoundSummaries(access.rounds, access.quiz, (r) => attempts.get(r) ?? null)
}

export function studentRoundSummaries(
  rounds: StudentRounds,
  quiz: QuizDetail,
  attemptFor: (round: QuizRound) => AttemptRecord | null
): Record<QuizRound, StudentRoundSummary> {
  return Object.fromEntries(
    QUIZ_ROUNDS.map((r) => [r, roundSummaryForStudent(rounds[r], attemptFor(r), quiz)])
  ) as Record<QuizRound, StudentRoundSummary>
}
