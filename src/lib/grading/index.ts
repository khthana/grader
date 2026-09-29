import type { GradeMode, GradeResult, TestCase, TestResult } from "@/types"
import { checkCodePolicy } from "@/lib/code-policy"
import { runTestCases, runUnitTestBlock } from "@/lib/piston"
import { problemMaxScore, testCaseScore } from "@/lib/problems/score"
import type { ProblemType } from "@/lib/problems/problem-type"

// The Piston seam expressed as an interface. Grading depends on this contract,
// not on the HTTP module directly — so tests inject a fake runner (no network)
// and the real adapter (pistonRunner) stays the only thing that touches Piston.
export interface CodeRunner {
  runTestCases(code: string, cases: TestCase[], language: string): Promise<TestResult[]>
  runUnitTestBlock(studentCode: string, unitTestCode: string): Promise<TestResult>
}

// Default adapter: the real Piston-backed runner.
export const pistonRunner: CodeRunner = { runTestCases, runUnitTestBlock }

// The slice of a Problem that grading needs. ProblemDetail satisfies this
// structurally; the narrow shape keeps grading decoupled from the repository.
export interface GradableProblem {
  problemType: ProblemType
  language: string
  score: number
  unitTestCode: string
  blacklist: string[]
  whitelist: string[]
  testCases: Array<{
    id: number
    input: string
    expectedOutput: string
    isHidden: boolean
    score?: number
  }>
}

function summarize(
  results: TestResult[],
  pointsEarned: number,
  pointsMax: number
): GradeResult {
  const passedTests = results.filter((r) => r.passed).length
  const totalTests = results.length
  return {
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
}

// Deep module: grading a Submission. Owns Code Policy → io/unit dispatch →
// per-Test-Case scoring and the single pointsMax computation. Knows nothing
// about auth, deadlines, enrollment, or persistence — those stay in the route.
export async function gradeSubmission(
  problem: GradableProblem,
  code: string,
  mode: GradeMode,
  runner: CodeRunner = pistonRunner
): Promise<GradeResult> {
  const isUnit = problem.problemType === "unit"

  // Code policy is checked first; a violation scores zero without running code.
  const policy = checkCodePolicy(code, problem.blacklist ?? [], problem.whitelist ?? [])
  if (!policy.ok) {
    const pointsMax = problemMaxScore(problem)
    return {
      pointsEarned: 0,
      pointsMax,
      totalTests: 0,
      passedTests: 0,
      results: [],
      feedback: `ละเมิดนโยบาย code: ${policy.violations.map((v) => `\`${v}\``).join(", ")}`,
      policyViolations: policy.violations,
    }
  }

  // Unit mode (#55): single test-code block, all-or-nothing scoring.
  if (isUnit) {
    const result = await runner.runUnitTestBlock(code, problem.unitTestCode)
    const pointsMax = problemMaxScore(problem)
    return summarize([result], result.passed ? pointsMax : 0, pointsMax)
  }

  // io mode: run visible cases on `run`, all cases on `submit`; sum the scores
  // of passing cases. pointsMax is the total of the cases actually run.
  const cases: TestCase[] = (
    mode === "run" ? problem.testCases.filter((tc) => !tc.isHidden) : problem.testCases
  ).map((tc) => ({
    id: tc.id,
    input: tc.input,
    expectedOutput: tc.expectedOutput,
    isHidden: tc.isHidden,
  }))

  const results = await runner.runTestCases(code, cases, problem.language)
  const scoreMap = new Map(problem.testCases.map((tc) => [tc.id, testCaseScore(tc.score)]))
  const pointsEarned = results
    .filter((r) => r.passed)
    .reduce((sum, r) => sum + (scoreMap.get(r.testCaseId) ?? 0), 0)
  const pointsMax = cases.reduce((sum, tc) => sum + (scoreMap.get(tc.id) ?? 0), 0)
  return summarize(results, pointsEarned, pointsMax)
}

// A Student's view of a GradeResult (#71): results for hidden Test Cases keep
// pass/fail but lose expected/actual output and error — any of those could
// leak the hidden input or answer (a program can echo stdin to stderr).
// Scores are untouched. The stored Submission keeps the full results.
export function redactHiddenResults(
  result: GradeResult,
  testCases: Array<{ id: number; isHidden: boolean }>
): GradeResult {
  const hiddenIds = new Set(testCases.filter((tc) => tc.isHidden).map((tc) => tc.id))
  return {
    ...result,
    results: result.results.map((r) =>
      hiddenIds.has(r.testCaseId)
        ? {
            testCaseId: r.testCaseId,
            passed: r.passed,
            executionTime: r.executionTime,
            expectedOutput: "",
            actualOutput: "",
            hidden: true,
          }
        : r
    ),
  }
}
