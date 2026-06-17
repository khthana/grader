"use client"

import { useEffect, useState } from "react"
import * as XLSX from "xlsx"
import { scoreTier, paginate, type ScoreTier } from "@/lib/gradebook/display"
import { gradebookToSheet } from "@/lib/gradebook/export"

type ScorebookStatus = "complete" | "late" | "missing" | "none-due"

interface GradebookProblem {
  id: number
  title: string
  weekNo: number
  pointsMax: number
  dueAt: string | null
}

interface GradebookStudent {
  userId: number
  name: string
  idCode: string | null
  scores: Record<number, number | null>
  status: ScorebookStatus
}

interface Gradebook {
  problems: GradebookProblem[]
  students: GradebookStudent[]
}

const PER_PAGE = 20

const STATUS_META: Record<ScorebookStatus, { dot: string; label: string }> = {
  complete: { dot: "bg-green-500", label: "ส่งครบ" },
  late: { dot: "bg-yellow-400", label: "ส่งช้า" },
  missing: { dot: "bg-red-500", label: "ค้างส่ง" },
  "none-due": { dot: "bg-slate-300", label: "ยังไม่ถึงกำหนด" },
}

const TIER_PILL: Record<Exclude<ScoreTier, "empty">, string> = {
  hi: "bg-green-100 text-green-700",
  mid: "bg-yellow-100 text-yellow-700",
  lo: "bg-red-100 text-red-600",
}

function StatusDot({ status }: { status: ScorebookStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${meta.dot}`}
      title={meta.label}
      aria-label={meta.label}
    />
  )
}

function ScorePill({ score, pointsMax }: { score: number | null; pointsMax: number }) {
  const tier = scoreTier(score, pointsMax)
  if (tier === "empty") return <span className="text-slate-300">–</span>
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TIER_PILL[tier]}`}>
      {score}
    </span>
  )
}

export function GradebookTable({ courseId, courseCode = "" }: { courseId: number; courseCode?: string }) {
  const [gradebook, setGradebook] = useState<Gradebook | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch(`/api/courses/${courseId}/gradebook`)
      .then((r) => r.json())
      .then(({ gradebook: gb }) => {
        setGradebook(gb)
        setPage(1)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [courseId])

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-400 font-thai">กำลังโหลด...</div>
  }

  if (!gradebook || gradebook.students.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-slate-400 font-thai">
        ยังไม่มีนักศึกษาในรายวิชานี้
      </div>
    )
  }

  const { problems, students } = gradebook
  const weekNos = [...new Set(problems.map((p) => p.weekNo))].sort((a, b) => a - b)
  const totalMax = problems.reduce((s, p) => s + p.pointsMax, 0)

  // Per-week problem number (resets each week), matching the "ลำดับ" shown on
  // /problems — both order by week_no then p.id. Keeps headers compact; the full
  // title stays reachable via the column's hover tooltip.
  const problemNo = new Map<number, number>()
  const perWeekCount = new Map<number, number>()
  for (const p of problems) {
    const n = (perWeekCount.get(p.weekNo) ?? 0) + 1
    perWeekCount.set(p.weekNo, n)
    problemNo.set(p.id, n)
  }

  const { pageItems, pageCount, page: current } = paginate(students, page, PER_PAGE)
  const offset = (current - 1) * PER_PAGE

  function exportXlsx() {
    const ws = XLSX.utils.aoa_to_sheet(gradebookToSheet(gradebook!))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "scorebook")
    XLSX.writeFile(wb, `scorebook-${courseCode || courseId}.xlsx`)
  }

  return (
    <div className="flex flex-col gap-3 font-thai">
      {/* Legend + export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          {(Object.keys(STATUS_META) as ScorebookStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <StatusDot status={s} />
              {STATUS_META[s].label}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={exportXlsx}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          ส่งออก Excel
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            {/* Week header row */}
            <tr className="bg-slate-100 text-xs font-semibold text-slate-500">
              <th className="sticky left-0 z-20 w-12 bg-slate-100 px-3 py-2 text-center" rowSpan={2}>
                #
              </th>
              <th className="sticky left-12 z-20 w-52 bg-slate-100 px-5 py-2 text-left" rowSpan={2}>
                รหัส / ชื่อ
              </th>
              <th className="sticky left-64 z-20 w-16 bg-slate-100 px-3 py-2 text-center" rowSpan={2}>
                สถานะ
              </th>
              {weekNos.map((wn) => {
                const weekProblems = problems.filter((p) => p.weekNo === wn)
                return (
                  <th
                    key={wn}
                    colSpan={weekProblems.length}
                    className="border-l border-slate-200 px-3 py-2 text-center"
                  >
                    สัปดาห์ {wn}
                  </th>
                )
              })}
              <th className="border-l border-slate-200 bg-blue-50 px-4 py-2 text-right text-primary" rowSpan={2}>
                รวม
                <br />
                <span className="font-normal text-slate-400">/{totalMax}</span>
              </th>
            </tr>
            {/* Problem title row */}
            <tr className="bg-slate-50 text-xs text-slate-400">
              {problems.map((p) => (
                <th
                  key={p.id}
                  className="border-l border-slate-200 px-3 py-1.5 text-center font-medium whitespace-nowrap"
                  title={p.title}
                >
                  ข้อ {problemNo.get(p.id)}
                  <br />
                  <span className="font-normal text-slate-300">/{p.pointsMax}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageItems.map((student, idx) => {
              const total = problems.reduce((sum, p) => sum + (student.scores[p.id] ?? 0), 0)
              return (
                <tr key={student.userId} className="group hover:bg-slate-50">
                  <td className="sticky left-0 z-10 w-12 bg-white px-3 py-3 text-center text-slate-400 group-hover:bg-slate-50">
                    {offset + idx + 1}
                  </td>
                  <td className="sticky left-12 z-10 w-52 bg-white px-5 py-3 group-hover:bg-slate-50">
                    <p className="font-medium text-slate-700">{student.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{student.idCode ?? "–"}</p>
                  </td>
                  <td className="sticky left-64 z-10 w-16 bg-white px-3 py-3 text-center group-hover:bg-slate-50">
                    <StatusDot status={student.status} />
                  </td>
                  {problems.map((p) => (
                    <td key={p.id} className="border-l border-slate-100 px-3 py-3 text-center">
                      <ScorePill score={student.scores[p.id]} pointsMax={p.pointsMax} />
                    </td>
                  ))}
                  <td className="border-l border-slate-200 bg-blue-50/40 px-4 py-3 text-right font-semibold text-primary">
                    {total}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-3 text-sm text-slate-500">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current <= 1}
            className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40 enabled:hover:bg-slate-50"
          >
            ก่อนหน้า
          </button>
          <span>
            หน้า {current} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current >= pageCount}
            className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40 enabled:hover:bg-slate-50"
          >
            ถัดไป
          </button>
        </div>
      )}
    </div>
  )
}
