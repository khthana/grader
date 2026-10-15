import { NextResponse } from "next/server"
import { getDb, withTransaction } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { safeLog } from "@/lib/logs"
import { parseQuizImport } from "@/lib/quizzes/import"
import { mergeQuizMeta } from "@/lib/quizzes/meta"
import { checkQuizWeek, readJsonObject } from "@/lib/quizzes/route-helpers"
import {
  deleteQuiz,
  getQuizForCourse,
  replaceQuestions,
  updateQuizMeta,
} from "@/lib/quizzes/repository"

type Params = { code: string; year: string; semester: string; qid: string }

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 })

function parseId(qid: string): number | null {
  const id = Number(qid)
  return Number.isInteger(id) && id > 0 ? id : null
}

// Staff-only until students get their own (key-free) view (#92).
export const GET = courseRoute<Params>({ staff: true }, async (_req, auth, { qid }) => {
  const id = parseId(qid)
  const quiz = id && (await getQuizForCourse(getDb(), auth.course, id))
  if (!quiz) return notFound()
  return NextResponse.json({ quiz })
})

/**
 * Edit metadata (`title`, `description`, `weekId`, `dontKnowEnabled` — omitted
 * keeps its value) and/or re-import the questions from `data` (questions only;
 * the file's title doesn't overwrite the Quiz's).
 */
export const PUT = courseRoute<Params>({ manage: true }, async (req, auth, { qid }) => {
  const id = parseId(qid)
  const db = getDb()
  const existing = id && (await getQuizForCourse(db, auth.course, id))
  if (!existing) return notFound()

  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const merged = mergeQuizMeta(body, existing)
  if (!merged.ok) return NextResponse.json({ error: merged.error }, { status: 400 })

  const weekError = await checkQuizWeek(db, auth.course, merged.meta.weekId)
  if (weekError) return weekError

  let questions = null
  if (body.data !== undefined) {
    const parsed = parseQuizImport(body.data)
    if (!parsed.ok) {
      return NextResponse.json({ error: "นำเข้าไม่สำเร็จ", errors: parsed.errors }, { status: 400 })
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
  return NextResponse.json({ quiz: await getQuizForCourse(db, auth.course, existing.id) })
})

export const DELETE = courseRoute<Params>({ manage: true }, async (_req, auth, { qid }) => {
  const id = parseId(qid)
  const db = getDb()
  const existing = id && (await getQuizForCourse(db, auth.course, id))
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
