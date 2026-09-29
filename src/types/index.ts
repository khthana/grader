export interface TestCase {
  id: number
  input: string
  expectedOutput: string
  isHidden: boolean
}

// The testCaseId of a result for the whole program rather than one Test Case:
// a compile failure (io) or the unit block.
export const PROGRAM_RESULT_ID = 0

export interface TestResult {
  testCaseId: number
  passed: boolean
  actualOutput: string
  expectedOutput: string
  executionTime: number
  error?: string
  // The program didn't run cleanly — compile failure, non-zero exit, signal,
  // or the runner itself failed — so its output was never compared. Lets
  // Reference verification tell 🔴 error from ⚠️ mismatch (#85).
  errored?: boolean
  // Set on a result the Student View withheld from a Student (hidden case,
  // unit block): pass/fail only, expected/actual/error are blanked (#71, #79, #84).
  hidden?: boolean
}

export interface GradeResult {
  pointsEarned: number
  pointsMax: number
  totalTests: number
  passedTests: number
  results: TestResult[]
  feedback: string
  // Present (non-empty) only when code policy blocked grading; the grade route
  // uses this to skip persisting a Submission for a policy violation.
  policyViolations?: string[]
}

// `run` = visible Test Cases only, nothing stored; `submit` = all cases + a Submission.
export type GradeMode = "run" | "submit"

// Body of POST /api/grade. The language is not sent — the route uses the
// Problem's (server-authoritative).
export interface SubmissionRequest {
  problemId: number
  code: string
  mode: GradeMode
}
