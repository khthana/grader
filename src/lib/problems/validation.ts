export interface ProblemInput {
  title?: string
  weekId?: number
  dueAt?: string | null
  closeAt?: string | null
  testCases?: Array<{ score?: number }>
}

export function validateProblemInput(input: ProblemInput): {
  valid: boolean
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}

  if (!input.title?.trim()) {
    errors.title = "ชื่อโจทย์ห้ามว่าง"
  }

  if (input.weekId == null) {
    errors.weekId = "กรุณาระบุสัปดาห์"
  }

  const cases = input.testCases ?? []
  if (cases.length === 0) {
    errors.testCases = "ต้องมีอย่างน้อย 1 test case"
  } else {
    const hasNegScore = cases.some((tc) => (tc.score ?? 0) < 0)
    if (hasNegScore) {
      errors.testCases = "คะแนนแต่ละ test case ต้องไม่ต่ำกว่า 0"
    }
  }

  if (input.dueAt && input.closeAt) {
    if (new Date(input.closeAt) < new Date(input.dueAt)) {
      errors.closeAt = "วันปิดรับต้องไม่ก่อนกำหนดส่ง"
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}
