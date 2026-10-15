import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { findQuizForCourse, quizNotFound } from "@/lib/quizzes/route-helpers"
import { loadQuizReport } from "@/lib/quizzes/report"

type Params = { code: string; year: string; semester: string; qid: string }

/** The Quiz Report (staff; TA reads). `?group=` narrows it to one Group ('' = ไม่ระบุกลุ่ม). */
export const GET = courseRoute<Params>({ staff: true }, async (req, auth, { qid }) => {
  const db = getDb()
  const quiz = await findQuizForCourse(db, auth.course, qid)
  if (!quiz) return quizNotFound()
  const group = new URL(req.url).searchParams.get("group")
  return NextResponse.json({ report: await loadQuizReport(db, auth.course, quiz, group, new Date()) })
})
