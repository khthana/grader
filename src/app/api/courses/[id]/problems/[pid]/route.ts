import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { authorizeCourse } from "@/lib/courses/authorize"
import {
  getProblemById,
  updateProblem,
  deleteProblem,
  setTestCases,
} from "@/lib/problems/repository"
import { validateProblemInput } from "@/lib/problems/validation"
import { safeLog } from "@/lib/logs"

type RouteContext = { params: Promise<{ id: string; pid: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { id, pid } = await context.params
  const auth = await authorizeCourse(request, id)
  if (!auth.ok) return auth.response

  const problemId = Number.parseInt(pid, 10)
  if (!Number.isFinite(problemId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const problem = await getProblemById(getDb(), problemId)
  if (!problem || problem.courseId !== auth.courseId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ problem })
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id, pid } = await context.params
  const auth = await authorizeCourse(request, id, { manage: true })
  if (!auth.ok) return auth.response

  const problemId = Number.parseInt(pid, 10)
  if (!Number.isFinite(problemId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    weekId?: number
    description?: string
    inputSpec?: string
    outputSpec?: string
    dueAt?: string | null
    closeAt?: string | null
    language?: string
    testCases?: Array<{
      input: string
      expectedOutput: string
      isHidden: boolean
      score: number
      sortOrder: number
    }>
  }

  const { valid, errors } = validateProblemInput({
    title: body.title,
    weekId: body.weekId,
    dueAt: body.dueAt,
    closeAt: body.closeAt,
    testCases: body.testCases,
  })
  if (!valid) return NextResponse.json({ errors }, { status: 400 })

  const db = getDb()
  const existing = await getProblemById(db, problemId)
  if (!existing || existing.courseId !== auth.courseId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const updated = await updateProblem(db, problemId, {
    title: body.title?.trim(),
    description: body.description?.trim(),
    inputSpec: body.inputSpec?.trim(),
    outputSpec: body.outputSpec?.trim(),
    dueAt: body.dueAt,
    closeAt: body.closeAt,
    language: body.language,
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

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id, pid } = await context.params
  const auth = await authorizeCourse(request, id, { manage: true })
  if (!auth.ok) return auth.response

  const problemId = Number.parseInt(pid, 10)
  if (!Number.isFinite(problemId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const db = getDb()
  const existing = await getProblemById(db, problemId)
  if (!existing || existing.courseId !== auth.courseId) {
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
