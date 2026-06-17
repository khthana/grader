"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FaPlus, FaPen, FaTrash } from "react-icons/fa"
import { WeekBar, type Week } from "./WeekBar"
import { ConfirmDialog } from "@/components/shell/ConfirmDialog"
import { useToast } from "@/components/shell/ToastProvider"

interface ProblemItem {
  id: number
  weekId: number
  weekNo: number
  title: string
  description: string
  pointsMax: number
  dueAt: string | null
  closeAt: string | null
  submittedCount: number
  pendingCount: number
  enrolledCount: number
}

function formatDate(iso: string | null) {
  if (!iso) return "–"
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function ProblemsTable({
  courseId,
  canManage,
}: {
  courseId: number
  canManage: boolean
}) {
  const router = useRouter()
  const { notify } = useToast()

  const [weeks, setWeeks] = useState<Week[]>([])
  const [activeWeekNo, setActiveWeekNo] = useState(1)
  const [problems, setProblems] = useState<ProblemItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<ProblemItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Load weeks once
  useEffect(() => {
    fetch(`/api/courses/${courseId}/weeks`)
      .then((r) => r.json())
      .then(({ weeks: w }: { weeks: Week[] }) => {
        setWeeks(w)
        if (w.length > 0) setActiveWeekNo(w[0].weekNo)
      })
      .catch(() => {})
  }, [courseId])

  // Load problems when active week changes
  useEffect(() => {
    const week = weeks.find((w) => w.weekNo === activeWeekNo)
    if (!week) return
    setLoading(true)
    fetch(`/api/courses/${courseId}/problems?week=${week.id}`)
      .then((r) => r.json())
      .then(({ problems: p }: { problems: ProblemItem[] }) => setProblems(p))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [courseId, weeks, activeWeekNo])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/courses/${courseId}/problems/${deleteTarget.id}`, {
      method: "DELETE",
    })
    setDeleting(false)
    setDeleteTarget(null)
    if (res.ok) {
      notify("success", `ลบโจทย์ "${deleteTarget.title}" เรียบร้อยแล้ว`)
      router.refresh()
      // re-fetch problems
      const week = weeks.find((w) => w.weekNo === activeWeekNo)
      if (week) {
        const r = await fetch(`/api/courses/${courseId}/problems?week=${week.id}`)
        const data = await r.json()
        setProblems(data.problems ?? [])
      }
    } else {
      notify("error", "ลบโจทย์ไม่สำเร็จ")
    }
  }

  const activeWeek = weeks.find((w) => w.weekNo === activeWeekNo)

  return (
    <div className="flex flex-col gap-4 font-thai">
      {weeks.length > 0 && (
        <WeekBar
          weeks={weeks}
          activeWeekNo={activeWeekNo}
          courseId={courseId}
          canManage={canManage}
          onWeekChange={setActiveWeekNo}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <span className="text-sm font-medium text-slate-600">
            {activeWeek ? `${activeWeek.topic || `สัปดาห์ที่ ${activeWeek.weekNo}`}` : "โจทย์ทั้งหมด"}
          </span>
          {canManage && (
            <Link
              href={`/problems/new?courseId=${courseId}&weekId=${activeWeek?.id ?? ""}`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm text-white transition hover:bg-primary-hover"
            >
              <FaPlus className="h-3 w-3" />
              สร้างโจทย์
            </Link>
          )}
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">กำลังโหลด...</div>
        ) : problems.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            ยังไม่มีโจทย์ในสัปดาห์นี้
            {canManage && (
              <span>
                {" "}—{" "}
                <Link
                  href={`/problems/new?courseId=${courseId}&weekId=${activeWeek?.id ?? ""}`}
                  className="text-secondary hover:underline"
                >
                  สร้างโจทย์แรก
                </Link>
              </span>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 text-left">ลำดับ</th>
                <th className="px-5 py-3 text-left">ชื่อโจทย์</th>
                <th className="px-5 py-3 text-right">คะแนน</th>
                <th className="px-5 py-3 text-left">กำหนดส่ง</th>
                <th className="px-5 py-3 text-center">ส่งแล้ว</th>
                <th className="px-5 py-3 text-center">รอตรวจ</th>
                {canManage && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {problems.map((p, idx) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4 text-slate-400">{idx + 1}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-700">{p.title}</p>
                    {p.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{p.description}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-slate-700">
                    {p.pointsMax}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{formatDate(p.dueAt)}</td>
                  <td className="px-5 py-4 text-center text-slate-600">
                    {p.submittedCount}/{p.enrolledCount}
                  </td>
                  <td className="px-5 py-4 text-center text-slate-600">
                    {p.pendingCount > 0 ? (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        {p.pendingCount}
                      </span>
                    ) : (
                      <span className="text-slate-300">–</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/problems/${p.id}/edit?courseId=${courseId}`}
                          className="rounded p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-secondary"
                          title="แก้ไข"
                        >
                          <FaPen className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          title="ลบ"
                        >
                          <FaTrash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="ลบโจทย์"
          message={`ต้องการลบโจทย์ "${deleteTarget.title}" ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
          confirmLabel="ลบโจทย์"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          busy={deleting}
        />
      )}
    </div>
  )
}
