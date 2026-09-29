import { NextRequest, NextResponse } from "next/server"
import type { SubmissionRequest } from "@/types"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { findEnrollment } from "@/lib/enrollments/repository"
import { createSubmission } from "@/lib/submissions/repository"
import { gradeSubmission } from "@/lib/grading"
import { gradeResultFor } from "@/lib/problems/student-view"
import { submissionWindow } from "@/lib/problems/submission-window"
import { resolveProblemVisibility } from "@/lib/problems/problem-access"

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

  // An unknown id, a problem in a course the user isn't linked to, and (for
  // non-staff) one in an unreleased week all get the same answer, so ids
  // can't be probed for existence (#80).
  const problemNotFound = () => NextResponse.json({ error: "Problem not found" }, { status: 404 })

  // Authorize against the problem's own course, for run as well as submit —
  // running code costs a Piston job and reveals test behaviour (#74). The
  // shared gate (#82) also hides unreleased Weeks from non-staff.
  const db = getDb()
  const visibility = await resolveProblemVisibility(db, user, Number(problemId))
  if (visibility.kind !== "visible") return problemNotFound()
  const { problem, access } = visibility

  const runMode = mode === "run" ? "run" : "submit"
  // One clock read per request: the close check and is_late agree (ADR 0002, #87).
  const deadlineState = submissionWindow(problem, new Date())

  if (runMode === "submit") {
    if (deadlineState === "closed") {
      return NextResponse.json({ error: "หมดเวลาส่งงานแล้ว" }, { status: 403 })
    }

    // Enrollment check: a student must be enrolled in this course.
    // access.staff = staff of *this* course, not a global TA/Instructor role.
    if (!access.staff) {
      const enrollment = await findEnrollment(db, access.course, user.id)
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
    const isLate = deadlineState === "late"
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

  // The stored Submission above keeps the full results; the viewer gets
  // their Student View of them (#71, #79, #84).
  return NextResponse.json(gradeResultFor(access, result, problem))
}
