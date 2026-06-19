"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FaCheckCircle, FaClock, FaExclamationTriangle, FaArrowRight } from "react-icons/fa"

interface AssignmentSubmission {
  pointsEarned: number | null
  manualScore: number | null
  effectiveScore: number | null
  isLate: boolean
  submittedAt: string
}

interface AssignmentItem {
  problemId: number
  problemNo: number
  title: string
  weekNo: number
  dueAt: string | null
  closeAt: string | null
  pointsMax: number
  submission: AssignmentSubmission | null
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function StatusBadge({ item }: { item: AssignmentItem }) {
  const now = new Date()
  const isClosed = item.closeAt ? new Date(item.closeAt) < now : false

  if (item.submission) {
    if (item.submission.isLate) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
          <FaClock className="h-3 w-3" /> ส่งช้า
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
        <FaCheckCircle className="h-3 w-3" /> ส่งแล้ว
      </span>
    )
  }

  if (isClosed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">
        <FaExclamationTriangle className="h-3 w-3" /> หมดเวลา
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
      ยังไม่ส่ง
    </span>
  )
}

function ScoreBadge({ item }: { item: AssignmentItem }) {
  if (!item.submission) return <span className="text-slate-300">–/{item.pointsMax}</span>
  const score = item.submission.effectiveScore ?? 0
  const full = score === item.pointsMax
  return (
    <span className={`font-semibold ${full ? "text-green-600" : "text-slate-700"}`}>
      {score}/{item.pointsMax}
      {item.submission.manualScore != null && (
        <span className="ml-1 text-xs font-normal text-blue-500">(ปรับแล้ว)</span>
      )}
    </span>
  )
}

export function AssignmentsList({
  courseSlug,
  coursePath,
}: {
  courseSlug: string
  coursePath: string
}) {
  const [items, setItems] = useState<AssignmentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/courses/${courseSlug}/assignments`)
      .then((r) => r.json())
      .then(({ assignments }) => setItems(assignments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [courseSlug])

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-400 font-thai">กำลังโหลด...</div>
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-slate-400 font-thai">
        ยังไม่มีโจทย์ในรายวิชานี้
      </div>
    )
  }

  // Group by week
  const weekNos = [...new Set(items.map((i) => i.weekNo))].sort((a, b) => a - b)

  return (
    <div className="flex flex-col gap-6 font-thai">
      {weekNos.map((wn) => {
        const weekItems = items.filter((i) => i.weekNo === wn)
        return (
          <div key={wn} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 bg-slate-50 px-5 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                สัปดาห์ที่ {wn}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">โจทย์</th>
                  <th className="px-5 py-3 text-left">กำหนดส่ง</th>
                  <th className="px-5 py-3 text-center">สถานะ</th>
                  <th className="px-5 py-3 text-right">คะแนน</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {weekItems.map((item) => (
                  <tr key={item.problemId} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-slate-700">{item.title}</td>
                    <td className="px-5 py-4 text-slate-500">
                      {formatDate(item.dueAt) ?? <span className="text-slate-300">–</span>}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <StatusBadge item={item} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <ScoreBadge item={item} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`${coursePath}/problems/${item.weekNo}/${item.problemNo}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-secondary px-3 py-1 text-xs font-medium text-secondary hover:bg-blue-50"
                      >
                        เปิดโจทย์ <FaArrowRight className="h-2.5 w-2.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
