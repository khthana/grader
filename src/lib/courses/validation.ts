// Pure validation for a course (create + edit form). program is optional.

export interface CourseInput {
  code: string
  nameTh: string
  nameEn: string
  program?: string
}

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

function isBlank(value: string | undefined): boolean {
  return !value || value.trim() === ""
}

export function validateCourseInput(input: CourseInput): ValidationResult {
  const errors: Record<string, string> = {}

  if (isBlank(input.code)) errors.code = "กรุณากรอกรหัสวิชา"
  if (isBlank(input.nameTh)) errors.nameTh = "กรุณากรอกชื่อวิชา (ภาษาไทย)"
  if (isBlank(input.nameEn)) errors.nameEn = "กรุณากรอกชื่อวิชา (ภาษาอังกฤษ)"

  return { valid: Object.keys(errors).length === 0, errors }
}
