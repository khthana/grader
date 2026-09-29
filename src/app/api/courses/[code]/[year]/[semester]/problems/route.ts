import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { createProblem, listProblems, setTestCases } from "@/lib/problems/repository"
import { validateProblemInput } from "@/lib/problems/validation"
import { problemMaxScore } from "@/lib/problems/score"
import { countSubmitted, countPending } from "@/lib/submissions/repository"
import { safeLog } from "@/lib/logs"
import { toProblemType } from "@/lib/problems/problem-type"

export const GET = courseRoute({}, async (request, auth) => {
  const url = new URL(request.url)
  const weekParam = url.searchParams.get("week")
  const weekId = weekParam ? Number.parseInt(weekParam, 10) : undefined

  const db = getDb()
  const problems = await listProblems(db, auth.course, weekId)

  const { rows: enrollRows } = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM enrollments
     WHERE course_code = $1 AND course_year = $2::int AND course_semester = $3::int`,
    [auth.course.code, auth.course.year, auth.course.semester]
  )
  const enrolledCount = Number(enrollRows[0]?.count ?? 0)

  const enriched = await Promise.all(
    problems.map(async (p) => ({
      ...p,
      submittedCount: await countSubmitted(db, p.id, auth.course),
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
    score?: number
    description?: string
    inputSpec?: string
    outputSpec?: string
    dueAt?: string | null
    closeAt?: string | null
    language?: string
    referenceSolution?: string
    problemType?: string
    functionName?: string
    starterCode?: string
    unitTestCode?: string
    blacklist?: string[]
    whitelist?: string[]
    testCases?: Array<{
      input: string
      expectedOutput: string
      isHidden: boolean
      score?: number
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
    problemType: body.problemType,
    functionName: body.functionName,
    unitTestCode: body.unitTestCode,
    blacklist: body.blacklist,
    whitelist: body.whitelist,
    // Validate against the course language so unit mode is rejected for C (#64).
    language: auth.course.language,
  })
  if (!valid) return NextResponse.json({ errors }, { status: 400 })

  const problemType = toProblemType(body.problemType)
  const db = getDb()
  const problem = await createProblem(db, {
    courseCode: auth.course.code,
    courseYear: auth.course.year,
    courseSemester: auth.course.semester,
    weekId: body.weekId!,
    title: body.title!.trim(),
    // Max score is derived server-side (#66): io = sum of test-case scores.
    score: problemMaxScore({
      problemType,
      score: body.score ?? 10,
      testCases: body.testCases ?? [],
    }),
    description: body.description?.trim(),
    inputSpec: body.inputSpec?.trim(),
    outputSpec: body.outputSpec?.trim(),
    dueAt: body.dueAt ?? null,
    closeAt: body.closeAt ?? null,
    // Language is course-authoritative (#63): every problem inherits the course
    // language; the client value is ignored.
    language: auth.course.language,
    referenceSolution: body.referenceSolution,
    problemType,
    functionName: body.functionName,
    starterCode: body.starterCode,
    unitTestCode: body.unitTestCode,
    blacklist: body.blacklist,
    whitelist: body.whitelist,
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
