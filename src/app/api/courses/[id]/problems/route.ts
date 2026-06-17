import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { authorizeCourse } from "@/lib/courses/authorize"
import { createProblem, listProblems, setTestCases } from "@/lib/problems/repository"
import { validateProblemInput } from "@/lib/problems/validation"
import { safeLog } from "@/lib/logs"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const auth = await authorizeCourse(request, id)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const weekParam = url.searchParams.get("week")
  const weekId = weekParam ? Number.parseInt(weekParam, 10) : undefined

  const problems = await listProblems(getDb(), auth.courseId, weekId)
  return NextResponse.json({ problems })
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const auth = await authorizeCourse(request, id, { manage: true })
  if (!auth.ok) return auth.response

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
  const problem = await createProblem(db, {
    courseId: auth.courseId,
    weekId: body.weekId!,
    title: body.title!.trim(),
    description: body.description?.trim(),
    inputSpec: body.inputSpec?.trim(),
    outputSpec: body.outputSpec?.trim(),
    dueAt: body.dueAt ?? null,
    closeAt: body.closeAt ?? null,
    language: body.language ?? "python",
  })

  const testCases = await setTestCases(db, problem.id, body.testCases ?? [])

  await safeLog(db, {
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "problem.create",
    targetId: problem.id,
  })

  return NextResponse.json({ problem: { ...problem, testCases } }, { status: 201 })
}
