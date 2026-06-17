import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { authorizeCourse } from "@/lib/courses/authorize"
import { getProblemById } from "@/lib/problems/repository"
import { getSubmission, reviewSubmission } from "@/lib/submissions/repository"

type RouteContext = { params: Promise<{ id: string; pid: string; sid: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { id, pid, sid } = await context.params
  const auth = await authorizeCourse(request, id)
  if (!auth.ok) return auth.response

  const problemId = Number.parseInt(pid, 10)
  const submissionId = Number.parseInt(sid, 10)
  if (!Number.isFinite(problemId) || !Number.isFinite(submissionId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const db = getDb()
  const problem = await getProblemById(db, problemId)
  if (!problem || problem.courseId !== auth.courseId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const submission = await getSubmission(db, submissionId)
  if (!submission || submission.problemId !== problemId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ submission })
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id, pid, sid } = await context.params
  const auth = await authorizeCourse(request, id, { manage: true })
  if (!auth.ok) return auth.response

  const problemId = Number.parseInt(pid, 10)
  const submissionId = Number.parseInt(sid, 10)
  if (!Number.isFinite(problemId) || !Number.isFinite(submissionId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const db = getDb()
  const problem = await getProblemById(db, problemId)
  if (!problem || problem.courseId !== auth.courseId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as { manualScore?: number | null }
  const manualScore = body.manualScore !== undefined ? body.manualScore : null

  const submission = await reviewSubmission(db, submissionId, {
    manualScore: typeof manualScore === "number" ? manualScore : null,
    reviewedBy: auth.user.id,
  })
  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ submission })
}
