// Pure validation for a single roster entry (add-student form + bulk import).
// Email is optional here (derived as {sid}@kmitl.ac.th when blank), unlike the
// general user form.

export interface EnrollFieldInput {
  idCode: string
  firstNameTh: string
  lastNameTh: string
  email?: string
}

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

// Pragmatic email check: something@something.tld (matches users/validation).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isBlank(value: string | undefined): boolean {
  return !value || value.trim() === ""
}

export function validateEnrollInput(input: EnrollFieldInput): ValidationResult {
  const errors: Record<string, string> = {}

  if (isBlank(input.idCode)) errors.idCode = "กรุณากรอกรหัสนักศึกษา"
  if (isBlank(input.firstNameTh)) errors.firstNameTh = "กรุณากรอกชื่อ"
  if (isBlank(input.lastNameTh)) errors.lastNameTh = "กรุณากรอกนามสกุล"

  // Email is optional; validate the format only when a non-blank value is given.
  if (!isBlank(input.email) && !EMAIL_RE.test(input.email!.trim())) {
    errors.email = "รูปแบบอีเมลไม่ถูกต้อง"
  }

  return { valid: Object.keys(errors).length === 0, errors }
}
