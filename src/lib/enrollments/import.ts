// Pure bulk-roster import validation (mirrors src/lib/users/import.ts). Takes
// the spreadsheet rows the client parsed and returns per-row validity, so good
// rows are never blocked by bad ones. Actual enrollment happens server-side via
// the enroll service on the rows marked valid.

import { validateEnrollInput } from "./validation"
import type { EnrollInput } from "./enroll"

// One spreadsheet row, as the client hands it over (all cells are strings).
export interface RawRosterRow {
  idCode?: string
  titleTh?: string
  firstNameTh?: string
  lastNameTh?: string
  studyGroup?: string
  year?: string
  program?: string
  email?: string
}

export interface RosterRowResult {
  row: number // 1-based data-row number
  valid: boolean
  errors: Record<string, string>
  input?: EnrollInput // normalized; present only when valid
}

function clean(value: string | undefined): string {
  return (value ?? "").trim()
}

function toEnrollInput(raw: RawRosterRow): EnrollInput {
  return {
    idCode: clean(raw.idCode),
    titleTh: clean(raw.titleTh) || undefined,
    firstNameTh: clean(raw.firstNameTh),
    lastNameTh: clean(raw.lastNameTh),
    studyGroup: clean(raw.studyGroup) || undefined,
    year: clean(raw.year) || undefined,
    program: clean(raw.program) || undefined,
    email: clean(raw.email) || undefined,
  }
}

export function validateRosterRows(rows: RawRosterRow[]): RosterRowResult[] {
  const seenIdCodes = new Set<string>()

  return rows.map((raw, index) => {
    const input = toEnrollInput(raw)
    const { errors } = validateEnrollInput({
      idCode: input.idCode,
      firstNameTh: input.firstNameTh,
      lastNameTh: input.lastNameTh,
      email: input.email ?? undefined,
    })

    // Within-sheet duplicate id_code: first occurrence wins, later ones flagged.
    if (input.idCode && !errors.idCode) {
      if (seenIdCodes.has(input.idCode)) {
        errors.idCode = "รหัสนักศึกษาซ้ำกับแถวก่อนหน้าในไฟล์"
      } else {
        seenIdCodes.add(input.idCode)
      }
    }

    const valid = Object.keys(errors).length === 0
    return { row: index + 1, valid, errors, input: valid ? input : undefined }
  })
}
