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
}

export interface SubmissionRequest {
  problemId: number
  code: string
  language: string
  mode: "run" | "submit"
}
