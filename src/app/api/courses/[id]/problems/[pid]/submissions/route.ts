import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { getProblemById } from "@/lib/problems/repository"
import { listSubmissionsForProblem } from "@/lib/submissions/repository"

export const GET = courseRoute<{ id: string; pid: string }>(
  {},
  async (_request, auth, { pid }) => {
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
)
