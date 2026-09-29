import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { createProblem, listProblems, setTestCases } from "@/lib/problems/repository"
import { buildProblemDraft, type ProblemBody } from "@/lib/problems/draft"
import { countSubmitted, countPending } from "@/lib/submissions/repository"
import { safeLog } from "@/lib/logs"

export const GET = courseRoute({}, async (request, auth) => {
  const url = new URL(request.url)
  const weekParam = url.searchParams.get("week")
  const weekId = weekParam ? Number.parseInt(weekParam, 10) : undefined

  const db = getDb()
  const problems = await listProblems(db, auth.course, { weekId, releasedOnly: !auth.staff })
  // Class-wide counts are roster information — staff only (#77, ADR 0001).
  if (!auth.staff) return NextResponse.json({ problems })

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
  const body = (await request.json().catch(() => ({}))) as ProblemBody
  const result = buildProblemDraft(body, { language: auth.course.language })
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 })
  const { testCases: draftCases, ...draft } = result.draft

  const db = getDb()
  const problem = await createProblem(db, {
    courseCode: auth.course.code,
    courseYear: auth.course.year,
    courseSemester: auth.course.semester,
    ...draft,
  })

  const testCases = await setTestCases(db, problem.id, draftCases)

  await safeLog(db, {
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "problem.create",
    targetId: problem.id,
  })

  return NextResponse.json({ problem: { ...problem, testCases } }, { status: 201 })
})
