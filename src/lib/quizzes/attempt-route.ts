// Shared front half of the Student Attempt routes (#92): who may take which
// round, judged on the server against the Student's *current* Group at `now`.
import { NextResponse } from "next/server"
import type { Queryable } from "@/lib/db"
import type { CourseRecord } from "@/lib/courses/types"
import { isAttemptSubmitted } from "./attempt"
import { getOrStartAttempt, type AttemptRecord } from "./attempt-repository"
import { resolveStudentQuiz, type StudentQuizAccess } from "./quiz-access"
import { quizForStudent, attemptForStudent } from "./result-view"
import { isQuizRound, type QuizRound, type RoundWindowState } from "./round-window"
import { quizNotFound } from "./route-helpers"

export interface StudentRound extends StudentQuizAccess {
  round: QuizRound
  state: RoundWindowState
}

const forbidden = (error: string) => NextResponse.json({ error }, { status: 403 })

/** The round as this Student may see it, or the error response (403 staff, 404 not visible). */
export async function resolveStudentRound(
  db: Queryable,
  auth: { course: CourseRecord; user: { id: number }; staff: boolean },
  qid: string,
  round: string,
  now: Date
): Promise<StudentRound | NextResponse> {
  if (auth.staff) return forbidden("ผู้สอนใช้ \"ดูตัวอย่าง\" แทนการทำแบบทดสอบ")
  if (!isQuizRound(round)) return quizNotFound()
  const access = await resolveStudentQuiz(db, auth.course, auth.user.id, qid, now)
  if (!access) return quizNotFound()
  return { ...access, round, state: access.rounds[round].state }
}

/**
 * The attempt a write may change: the round must be open for the Student's
 * Group and their attempt (started now if needed) not yet submitted.
 */
export async function writableAttempt(
  db: Queryable,
  r: StudentRound,
  userId: number
): Promise<AttemptRecord | NextResponse> {
  if (r.state !== "open") return forbidden("รอบนี้ไม่ได้เปิดให้ทำอยู่")
  const attempt = await getOrStartAttempt(db, r.quiz.id, r.round, userId)
  if (isAttemptSubmitted(attempt, r.state)) return forbidden("ส่งคำตอบรอบนี้แล้ว แก้ไขไม่ได้")
  return attempt
}

export function attemptResponse(r: StudentRound, attempt: AttemptRecord | null) {
  return NextResponse.json({
    round: r.round,
    state: r.state,
    window: r.rounds[r.round],
    quiz: quizForStudent(r.quiz),
    attempt: attempt && attemptForStudent(attempt, r.quiz, r.state),
  })
}
