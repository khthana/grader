import { NextResponse } from "next/server"
import { getDb, withTransaction } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { safeLog } from "@/lib/logs"
import { findQuizForCourse, quizNotFound, readJsonObject } from "@/lib/quizzes/route-helpers"
import { listWindows, mergeWindowChanges, quizGroups, saveWindows, windowGrid } from "@/lib/quizzes/windows"
import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"

type Params = { code: string; year: string; semester: string; qid: string }

/** The grid, with each state judged at the request's one `now`. */
async function gridResponse(db: Queryable, course: CourseKey, quizId: number, now: Date) {
  const stored = await listWindows(db, quizId)
  const groups = await quizGroups(db, course, stored)
  return NextResponse.json({ groups: windowGrid(groups, stored, now) })
}

/** The Round Window grid — one row per Group, Pre/Post with state by the server clock. */
export const GET = courseRoute<Params>({ staff: true }, async (_req, auth, { qid }) => {
  const db = getDb()
  const quiz = await findQuizForCourse(db, auth.course, qid)
  if (!quiz) return quizNotFound()
  return gridResponse(db, auth.course, quiz.id, new Date())
})

/**
 * Set Round Windows: `{ windows: [{ round, groupKey, opensAt?, closesAt? }] }`,
 * each instant an ISO string, `"now"` or null (omitted keeps it). All or nothing.
 */
export const PUT = courseRoute<Params>({ manage: true }, async (req, auth, { qid }) => {
  const db = getDb()
  const now = new Date()
  const quiz = await findQuizForCourse(db, auth.course, qid)
  if (!quiz) return quizNotFound()

  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const stored = await listWindows(db, quiz.id)
  const groups = await quizGroups(db, auth.course, stored)
  const merged = mergeWindowChanges(body.windows, { stored, groups, now })
  if (!merged.ok) return NextResponse.json({ error: merged.error }, { status: 400 })

  await withTransaction((tx) => saveWindows(tx, quiz.id, merged.windows))
  await safeLog(db, {
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "quiz.window",
    targetId: quiz.id,
  })
  return gridResponse(db, auth.course, quiz.id, now)
})
