// Pure validation for a course (create + edit form). program is optional.

export interface CourseInput {
  code: string
  year: number
  semester: number
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

// Validate the (year, semester) that identify a course offering. Shared by
// course create/edit and by course duplication's target key.
export function validateCourseOffering(year: number, semester: number): ValidationResult {
  const errors: Record<string, string> = {}
  if (!Number.isInteger(year) || year < 2500 || year > 2700)
    errors.year = "ปีการศึกษาไม่ถูกต้อง (พ.ศ. 2500–2700)"
  if (![1, 2, 3].includes(semester))
    errors.semester = "ภาคการศึกษาต้องเป็น 1, 2 หรือ 3"
  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateCourseInput(input: CourseInput): ValidationResult {
  const errors: Record<string, string> = {
    ...validateCourseOffering(input.year, input.semester).errors,
  }

  if (isBlank(input.code)) errors.code = "กรุณากรอกรหัสวิชา"
  if (isBlank(input.nameTh)) errors.nameTh = "กรุณากรอกชื่อวิชา (ภาษาไทย)"
  if (isBlank(input.nameEn)) errors.nameEn = "กรุณากรอกชื่อวิชา (ภาษาอังกฤษ)"

  return { valid: Object.keys(errors).length === 0, errors }
}
