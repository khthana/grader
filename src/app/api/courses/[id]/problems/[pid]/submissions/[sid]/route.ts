import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { getProblemById } from "@/lib/problems/repository"
import { getSubmission, reviewSubmission } from "@/lib/submissions/repository"

export const GET = courseRoute<{ id: string; pid: string; sid: string }>(
  {},
  async (_request, auth, { pid, sid }) => {
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
)

export const PUT = courseRoute<{ id: string; pid: string; sid: string }>(
  { manage: true },
  async (request, auth, { pid, sid }) => {
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

    if (typeof manualScore === "number" && (manualScore < 0 || manualScore > problem.score)) {
      return NextResponse.json(
        { error: `manual_score ต้องอยู่ระหว่าง 0–${problem.score}` },
        { status: 400 }
      )
    }

    const submission = await reviewSubmission(db, submissionId, {
      manualScore: typeof manualScore === "number" ? manualScore : null,
      reviewedBy: auth.user.id,
    })
    if (!submission) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ submission })
  }
)
