import { NextResponse } from "next/server"
import { getDb, withTransaction } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { safeLog } from "@/lib/logs"
import { parseQuizImport } from "@/lib/quizzes/import"
import { mergeQuizMeta } from "@/lib/quizzes/meta"
import { checkQuizWeek, importErrorResponse, readJsonObject } from "@/lib/quizzes/route-helpers"
import { createQuiz, listQuizzes } from "@/lib/quizzes/repository"
import { lockedQuizIds } from "@/lib/quizzes/attempt-repository"
import { listQuizzesForStudent } from "@/lib/quizzes/quiz-access"

/**
 * Staff: every Quiz, with `locked` (any Student attempt). Students: only the
 * Quizzes opened for their Group, each round with their own attempt summary.
 */
export const GET = courseRoute({}, async (_req, auth) => {
  const db = getDb()
  if (!auth.staff) {
    return NextResponse.json({ quizzes: await listQuizzesForStudent(db, auth.course, auth.user.id, new Date()) })
  }
  const [quizzes, locked] = await Promise.all([listQuizzes(db, auth.course), lockedQuizIds(db, auth.course)])
  return NextResponse.json({ quizzes: quizzes.map((q) => ({ ...q, locked: locked.has(q.id) })) })
})

/** Create a Quiz from the instructor's import JSON: `{ data, weekId?, dontKnowEnabled? }`. */
export const POST = courseRoute({ manage: true }, async (req, auth) => {
  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const parsed = parseQuizImport(body.data)
  if (!parsed.ok) {
    return importErrorResponse(parsed.errors)
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
