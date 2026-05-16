// โจทย์ที่นักศึกษาต้องทำ
export interface Problem {
  id: string
  title: string
  description: string
  testCases: TestCase[]
  timeLimit: number    // milliseconds
  memoryLimit: number  // MB
}

// test case สำหรับตรวจโค้ด
export interface TestCase {
  id: string
  input: string
  expectedOutput: string
  isHidden: boolean    // hidden = นักศึกษาไม่เห็น แต่ใช้ตรวจจริง
}

// ผลการรัน code แต่ละ test case
export interface TestResult {
  testCaseId: string
  passed: boolean
  actualOutput: string
  expectedOutput: string
  executionTime: number
  error?: string
}

// ผลการตรวจทั้งหมด
export interface GradeResult {
  score: number          // 0-100
  totalTests: number
  passedTests: number
  results: TestResult[]
  feedback: string
}

// ข้อมูลที่ส่งมาจาก client
export interface SubmissionRequest {
  problemId: string
  code: string
  language: string     // "python" เป็นหลัก
}