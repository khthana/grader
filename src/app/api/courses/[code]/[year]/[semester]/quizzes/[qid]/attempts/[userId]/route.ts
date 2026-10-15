import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { findQuizForCourse, parseId, quizNotFound } from "@/lib/quizzes/route-helpers"
import { loadStudentResult } from "@/lib/quizzes/report"

type Params = { code: string; year: string; semester: string; qid: string; userId: string }

/** One roster Student's Pre vs Post answers with the key (staff; TA reads). */
export const GET = courseRoute<Params>({ staff: true }, async (_req, auth, { qid, userId }) => {
  const db = getDb()
  const quiz = await findQuizForCourse(db, auth.course, qid)
  const id = parseId(userId)
  if (!quiz || id === null) return quizNotFound()
  const result = await loadStudentResult(db, auth.course, quiz, id, new Date())
  if (!result) return quizNotFound()
  return NextResponse.json({ result })
})
