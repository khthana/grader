import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import {
  getProblemById,
  updateProblem,
  deleteProblem,
  setTestCases,
} from "@/lib/problems/repository"
import { validateProblemInput } from "@/lib/problems/validation"
import { safeLog } from "@/lib/logs"

function ownsProblem(
  problem: { courseCode: string; courseYear: number; courseSemester: number },
  course: { code: string; year: number; semester: number }
) {
  return (
    problem.courseCode === course.code &&
    problem.courseYear === course.year &&
    problem.courseSemester === course.semester
  )
}

export const GET = courseRoute<{ code: string; year: string; semester: string; pid: string }>(
  {},
  async (_request, auth, { pid }) => {
    const problemId = Number.parseInt(pid, 10)
    if (!Number.isFinite(problemId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const problem = await getProblemById(getDb(), problemId)
    if (!problem || !ownsProblem(problem, auth.course)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ problem })
  }
)

export const PUT = courseRoute<{ code: string; year: string; semester: string; pid: string }>(
  { manage: true },
  async (request, auth, { pid }) => {
    const problemId = Number.parseInt(pid, 10)
    if (!Number.isFinite(problemId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      title?: string
      weekId?: number
      score?: number
      description?: string
      inputSpec?: string
      outputSpec?: string
      dueAt?: string | null
      closeAt?: string | null
      language?: string
      referenceSolution?: string
      testCases?: Array<{
        input: string
        expectedOutput: string
        isHidden: boolean
        sortOrder: number
      }>
    }

    const { valid, errors } = validateProblemInput({
      title: body.title,
      weekId: body.weekId,
      score: body.score,
      dueAt: body.dueAt,
      closeAt: body.closeAt,
      testCases: body.testCases,
    })
    if (!valid) return NextResponse.json({ errors }, { status: 400 })

    const db = getDb()
    const existing = await getProblemById(db, problemId)
    if (!existing || !ownsProblem(existing, auth.course)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const updated = await updateProblem(db, problemId, {
      title: body.title?.trim(),
      score: body.score,
      description: body.description?.trim(),
      inputSpec: body.inputSpec?.trim(),
      outputSpec: body.outputSpec?.trim(),
      dueAt: body.dueAt,
      closeAt: body.closeAt,
      language: body.language,
      referenceSolution: body.referenceSolution,
    })

    const testCases = await setTestCases(db, problemId, body.testCases ?? [])

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
    const existing = await getProblemById(db, problemId)
    if (!existing || !ownsProblem(existing, auth.course)) {
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
