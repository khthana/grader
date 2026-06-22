import { NextRequest, NextResponse } from "next/server"
import { runTestCases, runUnitTestBlock } from "@/lib/piston"
import type { SubmissionRequest, GradeResult, TestCase } from "@/types"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { getProblemById } from "@/lib/problems/repository"
import { findEnrollment } from "@/lib/enrollments/repository"
import { createSubmission } from "@/lib/submissions/repository"
import { checkCodePolicy } from "@/lib/code-policy"

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
      const courseKey = {
        code: problem.courseCode,
        year: problem.courseYear,
        semester: problem.courseSemester,
      }
      const enrollment = await findEnrollment(db, courseKey, user.id)
      if (!enrollment) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }
  }

  const isUnit = problem.problemType === "unit"

  const policy = checkCodePolicy(code, problem.blacklist ?? [], problem.whitelist ?? [])
  if (!policy.ok) {
    const pointsMax = isUnit
      ? problem.score
      : problem.testCases.reduce((s, tc) => s + (tc.score ?? 10), 0)
    return NextResponse.json({
      pointsEarned: 0,
      pointsMax,
      totalTests: 0,
      passedTests: 0,
      results: [],
      feedback: `ละเมิดนโยบาย code: ${policy.violations.map((v) => `\`${v}\``).join(", ")}`,
    } satisfies GradeResult)
  }

  let results
  let pointsEarned: number
  let pointsMax: number

  if (isUnit) {
    // Unit mode (#55): single test-code block, all-or-nothing scoring.
    const result = await runUnitTestBlock(code, problem.unitTestCode)
    results = [result]
    pointsMax = problem.score
    pointsEarned = result.passed ? problem.score : 0
  } else {
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

    results = await runTestCases(code, testCases)
    const scoreMap = new Map(problem.testCases.map((tc) => [tc.id, tc.score ?? 10]))
    pointsEarned = results
      .filter((r) => r.passed)
      .reduce((sum, r) => sum + (scoreMap.get(r.testCaseId) ?? 0), 0)
    pointsMax = testCases.reduce((sum, tc) => sum + (scoreMap.get(tc.id) ?? 0), 0)
  }

  const passedTests = results.filter((r) => r.passed).length
  const totalTests = results.length

  // Store submission only on mode:submit
  if (runMode === "submit") {
    const now = new Date()
    const isLate = problem.dueAt ? new Date(problem.dueAt) < now : false
    await createSubmission(db, {
      problemId: problem.id,
      userId: user.id,
      courseCode: problem.courseCode,
      courseYear: problem.courseYear,
      courseSemester: problem.courseSemester,
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
      passedTests === totalTests && totalTests > 0
        ? "ผ่านทุก test case!"
        : `ได้ ${pointsEarned}/${pointsMax} คะแนน`,
  }

  return NextResponse.json(gradeResult)
}
