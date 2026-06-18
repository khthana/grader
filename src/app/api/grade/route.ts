import { NextRequest, NextResponse } from "next/server"
import { runTestCases } from "@/lib/piston"
import type { SubmissionRequest, GradeResult, TestCase } from "@/types"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { getProblemById } from "@/lib/problems/repository"
import { findEnrollment } from "@/lib/enrollments/repository"
import { createSubmission } from "@/lib/submissions/repository"

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
    // Deadline enforcement (ADR 0002): close_at checked first
    const now = new Date()
    if (problem.closeAt && new Date(problem.closeAt) < now) {
      return NextResponse.json({ error: "หมดเวลาส่งงานแล้ว" }, { status: 403 })
    }

    // Enrollment check: student must be enrolled in this course
    const isPrivileged = user.roles.some((r) =>
      ["Admin", "Instructor", "TA"].includes(r)
    )
    if (!isPrivileged) {
      const enrollment = await findEnrollment(db, problem.courseId, user.id)
      if (!enrollment) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }
  }

  const testCases: TestCase[] = (
    runMode === "run"
      ? problem.testCases.filter((tc) => !tc.isHidden)
      : problem.testCases
  ).map((tc) => ({
    id: tc.id,
    input: tc.input,
    expectedOutput: tc.expectedOutput,
    isHidden: tc.isHidden,
  }))

  const results = await runTestCases(code, testCases)

  const allPassed = results.length > 0 && results.every((r) => r.passed)
  const pointsEarned = allPassed ? problem.score : 0
  const pointsMax = problem.score
  const passedTests = results.filter((r) => r.passed).length
  const totalTests = results.length

  // Store submission only on mode:submit
  if (runMode === "submit") {
    const now = new Date()
    const isLate = problem.dueAt ? new Date(problem.dueAt) < now : false
    await createSubmission(db, {
      problemId: problem.id,
      userId: user.id,
      courseId: problem.courseId,
      code,
      language: body.language ?? "python",
      pointsEarned,
      pointsMax,
      isLate,
      results,
    })
  }

  const gradeResult: GradeResult = {
    pointsEarned,
    pointsMax,
    totalTests,
    passedTests,
    results,
    feedback:
      allPassed
        ? "ผ่านทุก test case!"
        : `ได้ ${pointsEarned}/${pointsMax} คะแนน`,
  }

  return NextResponse.json(gradeResult)
}
