import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import {
  getProblemForCourse,
  updateProblem,
  deleteProblem,
  setTestCases,
} from "@/lib/problems/repository"
import { buildProblemDraft, type ProblemBody } from "@/lib/problems/draft"
import { problemFor } from "@/lib/problems/student-view"
import { canSeeWeek } from "@/lib/problems/problem-access"
import { getWeekForCourse } from "@/lib/weeks/repository"
import { safeLog } from "@/lib/logs"

export const GET = courseRoute<{ code: string; year: string; semester: string; pid: string }>(
  {},
  async (_request, auth, { pid }) => {
    const problemId = Number.parseInt(pid, 10)
    if (!Number.isFinite(problemId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const db = getDb()
    const problem = await getProblemForCourse(db, auth.course, problemId)
    if (!problem) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    // A problem in an unreleased Week doesn't exist for non-staff (#74, #82).
    const week = await getWeekForCourse(db, auth.course, problem.weekId)
    if (!week || !canSeeWeek(auth, week)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    // Students never receive hidden test cases or the unit-test block (#71, #84).
    return NextResponse.json({ problem: problemFor(auth, problem) })
  }
)

export const PUT = courseRoute<{ code: string; year: string; semester: string; pid: string }>(
  { manage: true },
  async (request, auth, { pid }) => {
    const problemId = Number.parseInt(pid, 10)
    if (!Number.isFinite(problemId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as ProblemBody
    const db = getDb()
    const existing = await getProblemForCourse(db, auth.course, problemId)
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // The body is merged over the stored Problem, and that merged Problem is
    // both what's validated and what's written (#83).
    const result = buildProblemDraft(body, { language: auth.course.language, existing })
    if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 })
    const { testCases: draftCases, ...draft } = result.draft

    // The draft keeps the stored weekId (updateProblem writes none anyway).
    const updated = await updateProblem(db, problemId, draft)
    const testCases = await setTestCases(db, problemId, draftCases)

    await safeLog(db, {
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      action: "problem.update",
      targetId: problemId,
    })

    return NextResponse.json({ problem: { ...updated, testCases } })
  }
)

export const DELETE = courseRoute<{ code: string; year: string; semester: string; pid: string }>(
  { manage: true },
  async (_request, auth, { pid }) => {
    const problemId = Number.parseInt(pid, 10)
    if (!Number.isFinite(problemId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const db = getDb()
    const existing = await getProblemForCourse(db, auth.course, problemId)
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await deleteProblem(db, problemId)

    await safeLog(db, {
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      action: "problem.delete",
      targetId: problemId,
    })

    return NextResponse.json({ ok: true })
  }
)
