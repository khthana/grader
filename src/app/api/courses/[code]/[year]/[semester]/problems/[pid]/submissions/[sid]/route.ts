import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { getProblemForCourse } from "@/lib/problems/repository"
import { getSubmission, reviewSubmission } from "@/lib/submissions/repository"

export const GET = courseRoute<{
  code: string
  year: string
  semester: string
  pid: string
  sid: string
}>(
  // Returns another student's code — Admin/Instructor only (ADR 0005).
  { manage: true },
  async (_request, auth, { pid, sid }) => {
    const problemId = Number.parseInt(pid, 10)
    const submissionId = Number.parseInt(sid, 10)
    if (!Number.isFinite(problemId) || !Number.isFinite(submissionId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const db = getDb()
    const problem = await getProblemForCourse(db, auth.course, problemId)
    if (!problem) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const submission = await getSubmission(db, submissionId)
    if (!submission || submission.problemId !== problemId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ submission })
  }
)

export const PUT = courseRoute<{
  code: string
  year: string
  semester: string
  pid: string
  sid: string
}>(
  { manage: true },
  async (request, auth, { pid, sid }) => {
    const problemId = Number.parseInt(pid, 10)
    const submissionId = Number.parseInt(sid, 10)
    if (!Number.isFinite(problemId) || !Number.isFinite(submissionId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const db = getDb()
    const problem = await getProblemForCourse(db, auth.course, problemId)
    if (!problem) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as { manualScore?: number | null }
    const manualScore = body.manualScore !== undefined ? body.manualScore : null

    if (typeof manualScore === "number" && (manualScore < 0 || manualScore > problem.score)) {
      return NextResponse.json(
        { error: `manual_score ต้องอยู่ระหว่าง 0–${problem.score}` },
        { status: 400 }
      )
    }

    // Scoped write: 404 unless this submission belongs to the problem (#72).
    const submission = await reviewSubmission(db, { id: submissionId, problemId }, {
      manualScore: typeof manualScore === "number" ? manualScore : null,
      reviewedBy: auth.user.id,
    })
    if (!submission) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ submission })
  }
)
