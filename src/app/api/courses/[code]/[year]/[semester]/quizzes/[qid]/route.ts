import { NextResponse } from "next/server"
import { getDb, withTransaction } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { safeLog } from "@/lib/logs"
import { parseQuizImport } from "@/lib/quizzes/import"
import { mergeQuizMeta } from "@/lib/quizzes/meta"
import {
  checkQuizWeek,
  findQuizForCourse,
  importErrorResponse,
  quizNotFound as notFound,
  readJsonObject,
} from "@/lib/quizzes/route-helpers"
import {
  deleteQuiz,
  getQuizForCourse,
  replaceQuestions,
  updateQuizMeta,
  type QuizDetail,
} from "@/lib/quizzes/repository"
import { isQuizLocked } from "@/lib/quizzes/attempt-repository"
import { resolveStudentQuiz, studentQuizView } from "@/lib/quizzes/quiz-access"
import { quizForStudent } from "@/lib/quizzes/result-view"
import type { Queryable } from "@/lib/db"

type Params = { code: string; year: string; semester: string; qid: string }

/**
 * Staff: the whole Quiz with its key, plus `locked`. Students: the questions
 * without the key and each round's state + their own attempt — 404 (like an
 * unknown id) until a round has opened for their Group.
 */
export const GET = courseRoute<Params>({}, async (_req, auth, { qid }) => {
  const db = getDb()
  if (!auth.staff) {
    const access = await resolveStudentQuiz(db, auth.course, auth.user.id, qid, new Date())
    if (!access) return notFound()
    return NextResponse.json({
      quiz: quizForStudent(access.quiz),
      ...(await studentQuizView(db, access, auth.user.id)),
    })
  }
  const quiz = await findQuizForCourse(db, auth.course, qid)
  if (!quiz) return notFound()
  return NextResponse.json({ quiz: await withLock(db, quiz) })
})

async function withLock(db: Queryable, quiz: QuizDetail) {
  return { ...quiz, locked: await isQuizLocked(db, quiz.id) }
}

/**
 * Edit metadata (`title`, `description`, `weekId`, `dontKnowEnabled` — omitted
 * keeps its value) and/or re-import the questions from `data` (questions only;
 * the file's title doesn't overwrite the Quiz's).
 */
export const PUT = courseRoute<Params>({ manage: true }, async (req, auth, { qid }) => {
  const db = getDb()
  const existing = await findQuizForCourse(db, auth.course, qid)
  if (!existing) return notFound()

  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const merged = mergeQuizMeta(body, existing)
  if (!merged.ok) return NextResponse.json({ error: merged.error }, { status: 400 })

  const weekError = await checkQuizWeek(db, auth.course, merged.meta.weekId)
  if (weekError) return weekError

  let questions = null
  if (body.data !== undefined) {
    if (await isQuizLocked(db, existing.id)) {
      return NextResponse.json(
        { error: "มีนักศึกษาเริ่มทำแบบทดสอบนี้แล้ว นำเข้าข้อสอบใหม่ไม่ได้" },
        { status: 409 }
      )
    }
    const parsed = parseQuizImport(body.data)
    if (!parsed.ok) {
      return importErrorResponse(parsed.errors)
    }
    questions = parsed.draft.questions
  }

  await withTransaction(async (tx) => {
    await updateQuizMeta(tx, existing.id, merged.meta)
    if (questions) await replaceQuestions(tx, existing.id, questions)
  })

  await safeLog(db, {
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "quiz.update",
    targetId: existing.id,
  })
  return NextResponse.json({ quiz: await withLock(db, (await getQuizForCourse(db, auth.course, existing.id))!) })
})

export const DELETE = courseRoute<Params>({ manage: true }, async (_req, auth, { qid }) => {
  const db = getDb()
  const existing = await findQuizForCourse(db, auth.course, qid)
  if (!existing) return notFound()

  await deleteQuiz(db, existing.id)
  await safeLog(db, {
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "quiz.delete",
    targetId: existing.id,
  })
  return NextResponse.json({ ok: true })
})
