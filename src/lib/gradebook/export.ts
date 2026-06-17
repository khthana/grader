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

  // Per-week problem number (resets each week), matching the on-screen header
  // and the /problems "ลำดับ". The week is kept in the label because the sheet's
  // header is a single flat row — without it every week would repeat "ข้อ 1…".
  const perWeekCount = new Map<number, number>()
  const problemLabels = problems.map((p) => {
    const n = (perWeekCount.get(p.weekNo) ?? 0) + 1
    perWeekCount.set(p.weekNo, n)
    return `สัปดาห์ ${p.weekNo} ข้อ ${n}`
  })

  const header = [...IDENTITY_HEADERS, ...problemLabels, "รวม"]

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
