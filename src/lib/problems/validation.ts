export interface ProblemInput {
  title?: string
  weekId?: number
  score?: number
  dueAt?: string | null
  closeAt?: string | null
  testCases?: unknown[]
  problemType?: string
  functionName?: string
  blacklist?: unknown[]
  whitelist?: unknown[]
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

  if (input.score != null && input.score < 0) {
    errors.score = "คะแนนโจทย์ต้องไม่ต่ำกว่า 0"
  }

  const cases = input.testCases ?? []
  if (cases.length === 0) {
    errors.testCases = "ต้องมีอย่างน้อย 1 test case"
  }

  if (input.problemType === "unit" && !input.functionName?.trim()) {
    errors.functionName = "ต้องระบุชื่อฟังก์ชันสำหรับโจทย์ประเภท Unit Test"
  }

  for (const list of ["blacklist", "whitelist"] as const) {
    const terms = input[list]
    if (terms != null && terms.some((t) => typeof t !== "string" || !(t as string).trim())) {
      errors[list] = `${list} ต้องเป็นรายการสตริงที่ไม่ว่าง`
    }
  }

  if (input.dueAt && input.closeAt) {
    if (new Date(input.closeAt) < new Date(input.dueAt)) {
      errors.closeAt = "วันปิดรับต้องไม่ก่อนกำหนดส่ง"
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}
