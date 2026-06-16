// Pure roster → spreadsheet mapper. Turns enrollment list items into an
// array-of-arrays (header + one row each) ready for XLSX.utils.aoa_to_sheet.

import type { EnrollmentListItem } from "./repository"

const HEADERS = [
  "รหัสนักศึกษา",
  "คำนำหน้า",
  "ชื่อ - นามสกุล",
  "หลักสูตร",
  "กลุ่ม",
  "ปีการศึกษา",
]

export function rosterToSheet(rows: EnrollmentListItem[]): string[][] {
  return [
    HEADERS,
    ...rows.map((r) => [
      r.sid ?? "",
      r.prefix ?? "",
      r.name,
      r.program ?? "",
      r.studyGroup ?? "",
      r.year ?? "",
    ]),
  ]
}
