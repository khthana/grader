import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { createProblem, listProblems, setTestCases } from "@/lib/problems/repository"
import { validateProblemInput } from "@/lib/problems/validation"
import { countSubmitted, countPending } from "@/lib/submissions/repository"
import { safeLog } from "@/lib/logs"

export const GET = courseRoute({}, async (request, auth) => {
  const url = new URL(request.url)
  const weekParam = url.searchParams.get("week")
  const weekId = weekParam ? Number.parseInt(weekParam, 10) : undefined

  const db = getDb()
  const problems = await listProblems(db, auth.courseId, weekId)

  // Attach submission counts for the instructor table
  const { rows: enrollRows } = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM enrollments WHERE course_id = $1::int`,
    [auth.courseId]
  )
  const enrolledCount = Number(enrollRows[0]?.count ?? 0)

  const enriched = await Promise.all(
    problems.map(async (p) => ({
      ...p,
      submittedCount: await countSubmitted(db, p.id, auth.courseId),
      pendingCount: await countPending(db, p.id),
      enrolledCount,
    }))
  )

  return NextResponse.json({ problems: enriched })
})

export const POST = courseRoute({ manage: true }, async (request, auth) => {
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
})
