"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { WeekBar, type Week } from "@/components/problems/WeekBar"
import { deriveAssignmentStatus } from "@/lib/assignments/status"
import type { AssignmentItem } from "@/lib/assignments/repository"

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
  const status = deriveAssignmentStatus(item, new Date())

  if (status === "reviewed") {
    const score = item.submission!.effectiveScore ?? 0
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
        ตรวจแล้ว · {score}/{item.pointsMax}
      </span>
    )
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
        ส่งแล้ว · รอตรวจ
      </span>
    )
  }
  if (status === "closed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">
        หมดเวลา
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
      ยังไม่ส่ง
    </span>
  )
}

function ActionButton({ item, coursePath }: { item: AssignmentItem; coursePath: string }) {
  const href = `${coursePath}/problems/${item.weekNo}/${item.problemNo}`
  const status = deriveAssignmentStatus(item, new Date())

  if (item.submission) {
    return (
      <Link
        href={href}
        className="inline-flex items-center rounded-lg border border-secondary px-3 py-1.5 text-xs font-medium text-secondary hover:bg-blue-50"
      >
        ดูงาน
      </Link>
    )
  }
  if (status === "closed") {
    return (
      <Link
        href={href}
        className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
      >
        ดูโจทย์
      </Link>
    )
  }
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover"
    >
      ทำโจทย์
    </Link>
  )
}

export function AssignmentsList({
  courseSlug,
  coursePath,
  initialWeek,
}: {
  courseSlug: string
  coursePath: string
  initialWeek: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeWeekNo = parseInt(searchParams.get("week") ?? String(initialWeek), 10) || initialWeek

  const [weeks, setWeeks] = useState<Week[]>([])
  const [items, setItems] = useState<AssignmentItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/courses/${courseSlug}/weeks`).then((r) => r.json()),
      fetch(`/api/courses/${courseSlug}/assignments`).then((r) => r.json()),
    ])
      .then(([weeksBody, assignBody]) => {
        setWeeks(weeksBody.weeks ?? [])
        setItems(assignBody.assignments ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [courseSlug])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function handleWeekChange(weekNo: number) {
    router.push(`?week=${weekNo}`)
  }

  const activeWeek = weeks.find((w) => w.weekNo === activeWeekNo)
  const weekItems = items.filter((i) => i.weekNo === activeWeekNo)

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-400">กำลังโหลด...</div>
  }

  return (
    <div className="flex flex-col gap-6 font-thai">
      {weeks.length > 0 && (
        <WeekBar
          weeks={weeks}
          activeWeekNo={activeWeekNo}
          courseSlug={courseSlug}
          canManage={false}
          onWeekChange={handleWeekChange}
          onWeeksChanged={() => {}}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-baseline justify-between border-b border-gray-100 bg-slate-50 px-5 py-3">
          <span className="font-semibold text-slate-700">
            สัปดาห์ที่ {activeWeekNo}
            {activeWeek?.topic ? ` · ${activeWeek.topic}` : ""}
          </span>
          <span className="text-sm text-slate-400">{weekItems.length} งาน</span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 py-3 text-left">ลำดับ</th>
              <th className="px-5 py-3 text-left">ชื่อโจทย์</th>
              <th className="px-5 py-3 text-left">กำหนดส่ง</th>
              <th className="px-5 py-3 text-center">คะแนนเต็ม</th>
              <th className="px-5 py-3 text-center">สถานะ</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {weekItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                  ยังไม่มีงานในสัปดาห์นี้
                </td>
              </tr>
            ) : (
              weekItems.map((item) => (
                <tr key={item.problemId} className="hover:bg-slate-50">
                  <td className="px-5 py-4 font-mono text-slate-400">{item.problemNo}</td>
                  <td className="px-5 py-4 font-medium text-slate-700">{item.title}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-slate-500">
                    {formatDate(item.dueAt) ?? <span className="text-slate-300">–</span>}
                  </td>
                  <td className="px-5 py-4 text-center font-mono text-slate-600">
                    {item.pointsMax}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <StatusBadge item={item} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <ActionButton item={item} coursePath={coursePath} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
