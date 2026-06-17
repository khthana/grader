import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { authorizeCourse } from "@/lib/courses/authorize"
import { getProblemById } from "@/lib/problems/repository"
import { listSubmissionsForProblem } from "@/lib/submissions/repository"

type RouteContext = { params: Promise<{ id: string; pid: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { id, pid } = await context.params
  const auth = await authorizeCourse(request, id)
  if (!auth.ok) return auth.response

  const problemId = Number.parseInt(pid, 10)
  if (!Number.isFinite(problemId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const db = getDb()
  const problem = await getProblemById(db, problemId)
  if (!problem || problem.courseId !== auth.courseId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const submissions = await listSubmissionsForProblem(db, problemId)
  return NextResponse.json({ submissions })
}
