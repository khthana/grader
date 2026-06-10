import { validateUserInput, type UserInput } from "./validation"

// One spreadsheet row, as the client hands it over (all cells are strings).
export interface RawImportRow {
  titleTh?: string
  firstNameTh?: string
  lastNameTh?: string
  titleEn?: string
  firstNameEn?: string
  lastNameEn?: string
  email?: string
  phone?: string
  idCode?: string
  password?: string
  roles?: string // comma/semicolon separated, e.g. "Instructor,TA"
}

export interface ImportRowResult {
  row: number // 1-based data-row number
  valid: boolean
  errors: Record<string, string>
  input?: UserInput // normalized; present only when valid
}

function clean(value: string | undefined): string {
  return (value ?? "").trim()
}

function parseRoles(cell: string | undefined): string[] {
  return clean(cell)
    .split(/[,;]/)
    .map((r) => r.trim())
    .filter(Boolean)
}

function toUserInput(raw: RawImportRow): UserInput {
  const password = clean(raw.password)
  return {
    titleTh: clean(raw.titleTh) || undefined,
    firstNameTh: clean(raw.firstNameTh),
    lastNameTh: clean(raw.lastNameTh),
    titleEn: clean(raw.titleEn) || undefined,
    firstNameEn: clean(raw.firstNameEn) || undefined,
    lastNameEn: clean(raw.lastNameEn) || undefined,
    email: clean(raw.email),
    phone: clean(raw.phone) || undefined,
    idCode: clean(raw.idCode),
    password: password || undefined,
    roles: parseRoles(raw.roles),
  }
}

export function validateImportRows(rows: RawImportRow[]): ImportRowResult[] {
  const seenEmails = new Set<string>()

  return rows.map((raw, index) => {
    const input = toUserInput(raw)
    const { errors } = validateUserInput(input)

    // Within-sheet duplicate email: first occurrence wins, later ones flagged.
    const emailKey = input.email.toLowerCase()
    if (emailKey && !errors.email) {
      if (seenEmails.has(emailKey)) {
        errors.email = "อีเมลซ้ำกับแถวก่อนหน้าในไฟล์"
      } else {
        seenEmails.add(emailKey)
      }
    }

    const valid = Object.keys(errors).length === 0
    return {
      row: index + 1,
      valid,
      errors,
      input: valid ? input : undefined,
    }
  })
}
