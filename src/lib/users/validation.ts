export interface ProfileInput {
  nickname?: string | null
  pictureBase64?: string | null
}

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

export function validateProfileInput(input: ProfileInput): ValidationResult {
  const errors: Record<string, string> = {}

  if (input.nickname != null) {
    if (input.nickname.trim().length > 50) {
      errors.nickname = "ชื่อเล่นต้องไม่เกิน 50 ตัวอักษร"
    }
  }

  if (input.pictureBase64 != null && input.pictureBase64 !== "") {
    const commaIdx = input.pictureBase64.indexOf(",")
    const header = commaIdx >= 0 ? input.pictureBase64.slice(0, commaIdx) : ""
    const b64data = commaIdx >= 0 ? input.pictureBase64.slice(commaIdx + 1) : ""
    if (!header.match(/^data:image\/.+;base64$/) || !b64data) {
      errors.pictureBase64 = "รูปแบบรูปภาพไม่ถูกต้อง"
    } else {
      const byteLength = Buffer.from(b64data, "base64").length
      if (byteLength > 150 * 1024) {
        errors.pictureBase64 = "รูปภาพต้องมีขนาดไม่เกิน 150KB"
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function validatePasswordChange(input: PasswordChangeInput): ValidationResult {
  const errors: Record<string, string> = {}

  if (!input.currentPassword) errors.currentPassword = "กรุณากรอกรหัสผ่านเดิม"

  if (!input.newPassword) {
    errors.newPassword = "กรุณากรอกรหัสผ่านใหม่"
  } else {
    const hasLetter = /[A-Za-z]/.test(input.newPassword)
    const hasDigit = /\d/.test(input.newPassword)
    if (input.newPassword.length < 8 || !hasLetter || !hasDigit) {
      errors.newPassword = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรและตัวเลข"
    }
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = "กรุณายืนยันรหัสผ่านใหม่"
  } else if (!errors.newPassword && input.newPassword !== input.confirmPassword) {
    errors.confirmPassword = "รหัสผ่านไม่ตรงกัน"
  }

  return { valid: Object.keys(errors).length === 0, errors }
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
