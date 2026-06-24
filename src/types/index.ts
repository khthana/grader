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

export interface SubmissionRequest {
  problemId: number
  code: string
  language: string
  mode: "run" | "submit"
}
