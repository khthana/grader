import type { GradeMode, GradeResult, TestCase, TestResult } from "@/types"
import { checkCodePolicy } from "@/lib/code-policy"
import { runTestCases, runUnitTestBlock } from "@/lib/piston"
import { problemMaxScore, testCaseScore } from "@/lib/problems/score"
import { isProblemTypeAllowed, type ProblemType } from "@/lib/problems/problem-type"

// The Piston seam expressed as an interface. Grading depends on this contract,
// not on the HTTP module directly — so tests inject a fake runner (no network)
// and the real adapter (pistonRunner) stays the only thing that touches Piston.
export interface CodeRunner {
  runTestCases(code: string, cases: TestCase[], language: string): Promise<TestResult[]>
  runUnitTestBlock(studentCode: string, unitTestCode: string): Promise<TestResult>
}

// Default adapter: the real Piston-backed runner.
export const pistonRunner: CodeRunner = { runTestCases, runUnitTestBlock }

// Route-level seam, like setTestDb: route handlers take the runner from here so
// route tests inject a fake one instead of mocking the Piston module.
let testRunner: CodeRunner | null = null
export function setTestRunner(runner: CodeRunner | null): void {
  testRunner = runner
}
export function getCodeRunner(): CodeRunner {
  return testRunner ?? pistonRunner
}

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
  runner: CodeRunner = getCodeRunner()
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

// One Reference-verification output per input ("รันเฉลย"). `ok` = the program
// ran cleanly (no compile failure / non-zero exit / signal) — grading's own
// rule, so a stderr warning is still ok. The editor then shows ✅ when ok and
// the trimmed stdout equals the case's expected output (grading compares the
// same way), ⚠️ when ok but different, 🔴 when not ok.
export interface ReferenceOutput {
  stdout: string
  stderr: string
  ok: boolean
}

export type ReferenceDraft =
  | { code: string; problemType: "io"; inputs: string[] }
  | { code: string; problemType: "unit"; unitTestCode: string }

// Run a Reference Solution against draft Test Cases through the same
// CodeRunner as grading (#85), so verification can't disagree with grading.
export async function verifyReferenceSolution(
  draft: ReferenceDraft,
  language: string,
  runner: CodeRunner = getCodeRunner()
): Promise<ReferenceOutput[]> {
  const toOutput = (r: TestResult, ok: boolean): ReferenceOutput => ({
    stdout: r.actualOutput,
    stderr: r.error ?? "",
    ok,
  })

  if (draft.problemType === "unit") {
    // The harness is Python-only and takes no language — never hand it C (#85).
    if (!isProblemTypeAllowed("unit", language)) {
      throw new Error(`unit mode is not available for ${language}`)
    }
    const r = await runner.runUnitTestBlock(draft.code, draft.unitTestCode)
    return [toOutput(r, r.passed)]
  }

  // Draft cases have no ids yet — number them 1..n; expected output is unknown
  // (computing it is the point), so only `errored` is read, never `passed`.
  const cases: TestCase[] = draft.inputs.map((input, i) => ({
    id: i + 1,
    input,
    expectedOutput: "",
    isHidden: false,
  }))
  const results = await runner.runTestCases(draft.code, cases, language)
  const byId = new Map(results.map((r) => [r.testCaseId, r]))
  // A compile failure comes back as one synthetic result (id 0) for all cases.
  const compileFailure = byId.get(0)
  return cases.map((tc) => {
    const r = byId.get(tc.id) ?? compileFailure
    return r ? toOutput(r, !r.errored) : { stdout: "", stderr: "ไม่มีผลลัพธ์", ok: false }
  })
}
