import { NextRequest, NextResponse } from "next/server"
import type { SubmissionRequest } from "@/types"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { getProblemById } from "@/lib/problems/repository"
import { findEnrollment } from "@/lib/enrollments/repository"
import { createSubmission } from "@/lib/submissions/repository"
import { gradeSubmission } from "@/lib/grading"

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Partial<SubmissionRequest>
  const { problemId, code, mode } = body

  if (!problemId || !code) {
    return NextResponse.json(
      { error: "problemId and code are required" },
      { status: 400 }
    )
  }

  const db = getDb()
  const problem = await getProblemById(db, Number(problemId))
  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 })
  }

  const runMode = mode === "run" ? "run" : "submit"

  if (runMode === "submit") {
    // Deadline enforcement (ADR 0002): close_at checked first.
    const now = new Date()
    if (problem.closeAt && new Date(problem.closeAt) < now) {
      return NextResponse.json({ error: "หมดเวลาส่งงานแล้ว" }, { status: 403 })
    }

    // Enrollment check: a student must be enrolled in this course.
    const isPrivileged = user.roles.some((r) =>
      ["Admin", "Instructor", "TA"].includes(r)
    )
    if (!isPrivileged) {
      const enrollment = await findEnrollment(
        db,
        { code: problem.courseCode, year: problem.courseYear, semester: problem.courseSemester },
        user.id
      )
      if (!enrollment) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }
  }

  // The grading module owns Code Policy, io/unit dispatch, and scoring.
  const result = await gradeSubmission(problem, code, runMode)

  // Store the submission only on mode:submit — and never for a code-policy
  // violation (a violation is not a graded attempt; preserves pre-refactor
  // behavior where the route returned before persisting).
  if (runMode === "submit" && !result.policyViolations?.length) {
    const isLate = problem.dueAt ? new Date(problem.dueAt) < new Date() : false
    await createSubmission(db, {
      problemId: problem.id,
      userId: user.id,
      courseCode: problem.courseCode,
      courseYear: problem.courseYear,
      courseSemester: problem.courseSemester,
      code,
      language: problem.language,
      pointsEarned: result.pointsEarned,
      pointsMax: result.pointsMax,
      isLate,
      results: result.results,
    })
  }

  return NextResponse.json(result)
}
