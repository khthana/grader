// Pure Scorebook → spreadsheet mapper. Turns a gradebook into an array-of-arrays
// (header + one row per student) ready for XLSX.utils.aoa_to_sheet. Mirrors
// enrollments/export.ts#rosterToSheet.

import type { Gradebook } from "./repository"
import type { ScorebookStatus } from "./status"

const IDENTITY_HEADERS = ["#", "รหัสนักศึกษา", "ชื่อ - นามสกุล", "สถานะ"]

const STATUS_LABEL: Record<ScorebookStatus, string> = {
  complete: "ส่งครบ",
  late: "ส่งช้า",
  missing: "ค้างส่ง",
  "none-due": "ยังไม่ถึงกำหนด",
}

export function gradebookToSheet(gradebook: Gradebook): string[][] {
  const { problems, students } = gradebook

  const header = [...IDENTITY_HEADERS, ...problems.map((p) => p.title), "รวม"]

  const rows = students.map((s, idx) => {
    let total = 0
    const scoreCells = problems.map((p) => {
      const score = s.scores[p.id]
      if (score == null) return ""
      total += score
      return String(score)
    })
    return [
      String(idx + 1),
      s.idCode ?? "",
      s.name,
      STATUS_LABEL[s.status],
      ...scoreCells,
      String(total),
    ]
  })

  return [header, ...rows]
}
