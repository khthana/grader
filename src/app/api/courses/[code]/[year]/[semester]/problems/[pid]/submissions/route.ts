import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { getProblemForCourse } from "@/lib/problems/repository"
import { listSubmissionsForProblem } from "@/lib/submissions/repository"

export const GET = courseRoute<{ code: string; year: string; semester: string; pid: string }>(
  // Other students' submissions — Admin/Instructor only, like the review pages (ADR 0005).
  { manage: true },
  async (_request, auth, { pid }) => {
    const problemId = Number.parseInt(pid, 10)
    if (!Number.isFinite(problemId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const db = getDb()
    const problem = await getProblemForCourse(db, auth.course, problemId)
    if (!problem) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const submissions = await listSubmissionsForProblem(db, problemId)
    return NextResponse.json({ submissions })
  }
)
