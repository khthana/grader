import { NextResponse } from "next/server"
import { getDb, withTransaction } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { safeLog } from "@/lib/logs"
import { parseQuizImport } from "@/lib/quizzes/import"
import { mergeQuizMeta } from "@/lib/quizzes/meta"
import { checkQuizWeek, readJsonObject } from "@/lib/quizzes/route-helpers"
import { createQuiz, listQuizzes } from "@/lib/quizzes/repository"

// Staff-only until students get their own view (#92).
export const GET = courseRoute({ staff: true }, async (_req, auth) => {
  const quizzes = await listQuizzes(getDb(), auth.course)
  return NextResponse.json({ quizzes })
})

/** Create a Quiz from the instructor's import JSON: `{ data, weekId?, dontKnowEnabled? }`. */
export const POST = courseRoute({ manage: true }, async (req, auth) => {
  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const parsed = parseQuizImport(body.data)
  if (!parsed.ok) {
    return NextResponse.json({ error: "นำเข้าไม่สำเร็จ", errors: parsed.errors }, { status: 400 })
  }

  const merged = mergeQuizMeta(
    { weekId: body.weekId, dontKnowEnabled: body.dontKnowEnabled },
    {
      title: parsed.draft.title,
      description: parsed.draft.description,
      weekId: null,
      dontKnowEnabled: true,
    }
  )
  if (!merged.ok) return NextResponse.json({ error: merged.error }, { status: 400 })

  const db = getDb()
  const weekError = await checkQuizWeek(db, auth.course, merged.meta.weekId)
  if (weekError) return weekError

  const quiz = await withTransaction((tx) =>
    createQuiz(tx, auth.course, { ...merged.meta, questions: parsed.draft.questions })
  )
  await safeLog(db, {
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "quiz.create",
    targetId: quiz.id,
  })
  return NextResponse.json({ quiz }, { status: 201 })
})
