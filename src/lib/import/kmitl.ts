// Parser for the KMITL registrar "ใบคะแนนสอบ" (exam score sheet) export — the
// real file an instructor downloads for a course. It is a formatted report
// (repeated page headers, section/ตอน markers, the student name glued to its
// Thai prefix), not a clean column-per-field spreadsheet, so it needs bespoke
// parsing rather than XLSX.utils.sheet_to_json.

// Thai prefixes, longest-first so "นางสาว" wins over "นาง".
const PREFIXES = ["เด็กชาย", "เด็กหญิง", "นางสาว", "นาง", "นาย", "ด.ช.", "ด.ญ.", "น.ส."]

export interface ParsedKmitlStudent {
  idCode: string
  titleTh: string
  firstNameTh: string
  lastNameTh: string
  studyGroup: string
}

// Parse a KMITL exam-sheet (as an array-of-arrays from
// XLSX.utils.sheet_to_json(sheet, { header: 1 })) into student rows. Page
// headers and totals are ignored; a "ตอน N" cell sets the section/group that
// applies to the data rows beneath it, until the next marker.
export function parseKmitlSheet(rows: unknown[][]): ParsedKmitlStudent[] {
  const students: ParsedKmitlStudent[] = []
  let currentGroup = ""

  for (const row of rows) {
    if (!Array.isArray(row)) continue

    // Section marker: a cell like "ตอน 18".
    for (const cell of row) {
      if (typeof cell === "string") {
        const m = cell.match(/^\s*ตอน\s*(\S+)/)
        if (m) {
          currentGroup = m[1]
          break
        }
      }
    }

    // Data row: a student id (digits) in the second column with a name beside it.
    const idCode = row[1] == null ? "" : String(row[1]).trim()
    const nameCell = row[2] == null ? "" : String(row[2]).trim()
    if (/^\d{6,}$/.test(idCode) && nameCell !== "") {
      students.push({ idCode, ...splitThaiName(nameCell), studyGroup: currentGroup })
    }
  }

  return students
}

// Split a KMITL name cell (" นายอดิศร  วนาภรณ์") into prefix / first / last.
// The prefix is glued to the first name; first and last are space-separated.
export function splitThaiName(raw: string): {
  titleTh: string
  firstNameTh: string
  lastNameTh: string
} {
  let s = (raw ?? "").replace(/\s+/g, " ").trim()
  let titleTh = ""
  for (const p of PREFIXES) {
    if (s.startsWith(p)) {
      titleTh = p
      s = s.slice(p.length).trim()
      break
    }
  }
  const parts = s.split(" ").filter(Boolean)
  return {
    titleTh,
    firstNameTh: parts[0] ?? "",
    lastNameTh: parts.slice(1).join(" "),
  }
}
