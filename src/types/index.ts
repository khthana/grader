// test case สำหรับตรวจโค้ด
export interface TestCase {
  id: number
  input: string
  expectedOutput: string
  isHidden: boolean
  score: number
}

// ผลการรัน code แต่ละ test case
export interface TestResult {
  testCaseId: number
  score: number
  passed: boolean
  actualOutput: string
  expectedOutput: string
  executionTime: number
  error?: string
}

// ผลการตรวจทั้งหมด
export interface GradeResult {
  pointsEarned: number
  pointsMax: number
  totalTests: number
  passedTests: number
  results: TestResult[]
  feedback: string
}

// ข้อมูลที่ส่งมาจาก client
export interface SubmissionRequest {
  problemId: number
  code: string
  language: string
  mode: "run" | "submit"
}
