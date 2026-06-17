import { NextRequest, NextResponse } from "next/server"
import { runTestCases } from "@/lib/piston"
import type { SubmissionRequest, GradeResult, TestCase } from "@/types"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { getProblemById } from "@/lib/problems/repository"

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

  const problem = await getProblemById(getDb(), Number(problemId))
  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 })
  }

  // "run" = visible test cases only; "submit" = all (default to submit if not specified)
  const runMode = mode === "run" ? "run" : "submit"
  const testCases: TestCase[] = (
    runMode === "run"
      ? problem.testCases.filter((tc) => !tc.isHidden)
      : problem.testCases
  ).map((tc) => ({
    id: tc.id,
    input: tc.input,
    expectedOutput: tc.expectedOutput,
    isHidden: tc.isHidden,
    score: tc.score,
  }))

  const results = await runTestCases(code, testCases)

  const pointsEarned = results.reduce((sum, r) => sum + (r.passed ? r.score : 0), 0)
  const pointsMax = testCases.reduce((sum, tc) => sum + tc.score, 0)
  const passedTests = results.filter((r) => r.passed).length
  const totalTests = results.length

  const gradeResult: GradeResult = {
    pointsEarned,
    pointsMax,
    totalTests,
    passedTests,
    results,
    feedback:
      pointsEarned === pointsMax
        ? "ผ่านทุก test case!"
        : `ได้ ${pointsEarned}/${pointsMax} คะแนน`,
  }

  return NextResponse.json(gradeResult)
}
