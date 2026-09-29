export interface TestCase {
  id: number
  input: string
  expectedOutput: string
  isHidden: boolean
}

export interface TestResult {
  testCaseId: number
  passed: boolean
  actualOutput: string
  expectedOutput: string
  executionTime: number
  error?: string
  // Set on a hidden Test Case's result sent to a Student: pass/fail only,
  // expected/actual/error are blanked (#71).
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
