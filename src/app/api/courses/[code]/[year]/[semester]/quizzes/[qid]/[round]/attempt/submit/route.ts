import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { unansweredCount } from "@/lib/quizzes/attempt"
import { getAttempt, submitAttempt } from "@/lib/quizzes/attempt-repository"
import { attemptResponse, resolveStudentRound, writableAttempt } from "@/lib/quizzes/attempt-route"

type Params = { code: string; year: string; semester: string; qid: string; round: string }

/** Submit the attempt — once, and only when every question is answered (ไม่ทราบ counts). */
export const POST = courseRoute<Params>({}, async (_req, auth, { qid, round }) => {
  const db = getDb()
  const r = await resolveStudentRound(db, auth, qid, round, new Date())
  if (r instanceof NextResponse) return r
  const attempt = await writableAttempt(db, r, auth.user.id)
  if (attempt instanceof NextResponse) return attempt

  const missing = unansweredCount(r.quiz.questions, attempt.answers)
  if (missing > 0) {
    return NextResponse.json({ error: `ยังไม่ได้ตอบอีก ${missing} ข้อ` }, { status: 400 })
  }

  await submitAttempt(db, attempt.id)
  return attemptResponse(r, await getAttempt(db, r.quiz.id, r.round, auth.user.id))
})
