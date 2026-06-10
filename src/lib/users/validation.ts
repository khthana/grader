export interface UserInput {
  titleTh?: string
  firstNameTh: string
  lastNameTh: string
  titleEn?: string
  firstNameEn?: string
  lastNameEn?: string
  email: string
  phone?: string
  idCode: string
  password?: string
  roles?: string[]
}

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

const VALID_ROLES = ["Admin", "Instructor", "TA", "Student"]
// Pragmatic email check: something@something.tld
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isBlank(value: string | undefined): boolean {
  return !value || value.trim() === ""
}

export function validateUserInput(input: UserInput): ValidationResult {
  const errors: Record<string, string> = {}

  if (isBlank(input.firstNameTh)) errors.firstNameTh = "กรุณากรอกชื่อ (ภาษาไทย)"
  if (isBlank(input.lastNameTh)) errors.lastNameTh = "กรุณากรอกนามสกุล (ภาษาไทย)"
  if (isBlank(input.idCode)) errors.idCode = "กรุณากรอกรหัส"

  if (isBlank(input.email)) {
    errors.email = "กรุณากรอกอีเมล"
  } else if (!EMAIL_RE.test(input.email.trim())) {
    errors.email = "รูปแบบอีเมลไม่ถูกต้อง"
  }

  // Password is optional (Google-only accounts); validate the policy only if given.
  if (input.password) {
    const hasLetter = /[A-Za-z]/.test(input.password)
    const hasDigit = /\d/.test(input.password)
    if (input.password.length < 8 || !hasLetter || !hasDigit) {
      errors.password = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรและตัวเลข"
    }
  }

  if (input.roles && input.roles.some((r) => !VALID_ROLES.includes(r))) {
    errors.roles = "มีบทบาทที่ไม่ถูกต้อง"
  }

  return { valid: Object.keys(errors).length === 0, errors }
}
