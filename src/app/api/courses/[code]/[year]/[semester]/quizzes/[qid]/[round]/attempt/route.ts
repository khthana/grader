import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { mergeAnswers } from "@/lib/quizzes/attempt"
import { getAttempt, getOrStartAttempt, saveAnswers } from "@/lib/quizzes/attempt-repository"
import { attemptResponse, resolveStudentRound, writableAttempt } from "@/lib/quizzes/attempt-route"
import { readJsonObject } from "@/lib/quizzes/route-helpers"

type Params = { code: string; year: string; semester: string; qid: string; round: string }

/**
 * The Student's attempt at this round, with the questions (no key). Opening an
 * open round starts the attempt; a round that isn't open never starts one.
 */
export const GET = courseRoute<Params>({}, async (_req, auth, { qid, round }) => {
  const db = getDb()
  const r = await resolveStudentRound(db, auth, qid, round, new Date())
  if (r instanceof NextResponse) return r
  const attempt =
    r.state === "open"
      ? await getOrStartAttempt(db, r.quiz.id, r.round, auth.user.id)
      : await getAttempt(db, r.quiz.id, r.round, auth.user.id)
  return attemptResponse(r, attempt)
})

/** Save answers as the Student goes: `{ answers: { questionId: letter | "dont-know" | null } }`. */
export const PUT = courseRoute<Params>({}, async (req, auth, { qid, round }) => {
  const db = getDb()
  const r = await resolveStudentRound(db, auth, qid, round, new Date())
  if (r instanceof NextResponse) return r
  const attempt = await writableAttempt(db, r, auth.user.id)
  if (attempt instanceof NextResponse) return attempt

  const body = await readJsonObject(req)
  const merged = mergeAnswers(attempt.answers, body?.answers, {
    questions: r.quiz.questions,
    dontKnowEnabled: r.quiz.dontKnowEnabled,
  })
  if (!merged.ok) return NextResponse.json({ error: merged.error }, { status: 400 })

  await saveAnswers(db, attempt.id, merged.answers)
  return attemptResponse(r, { ...attempt, answers: merged.answers })
})
