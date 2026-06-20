"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { WeekBar, type Week } from "@/components/problems/WeekBar"
import { deriveAssignmentStatus } from "@/lib/assignments/status"
import { deriveScorebookSummary } from "@/lib/scorebook/summary"
import type { AssignmentItem } from "@/lib/assignments/repository"

function DonutRing({ percent }: { percent: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const dash = (percent / 100) * circ

  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="rotate-[-90deg]">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke="#003296"
        strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  )
}

function SummaryBanner({ items }: { items: AssignmentItem[] }) {
  const { earned, max, percent, solvedCount, totalCount } = deriveScorebookSummary(items)

  return (
    <div className="flex items-center gap-6 rounded-xl border border-gray-200 bg-white p-6">
      <div className="relative shrink-0">
        <DonutRing percent={percent} />
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-primary">
          {percent}%
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-3xl font-bold text-primary">
          {earned} <span className="text-lg font-normal text-slate-400">/ {max} คะแนน</span>
        </p>
        <p className="text-sm text-slate-500">
          ทำได้ {solvedCount} จาก {totalCount} โจทย์
        </p>
      </div>
    </div>
  )
}

function ScoreBadge({ item }: { item: AssignmentItem }) {
  const status = deriveAssignmentStatus(item, new Date())

  if (status === "reviewed") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
        ตรวจแล้ว
      </span>
    )
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
        ส่งแล้ว · รอตรวจ
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
      ยังไม่ส่ง
    </span>
  )
}

export function ScoreList({
  courseSlug,
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

  useEffect(() => {
    Promise.all([
      fetch(`/api/courses/${courseSlug}/weeks`).then((r) => r.json()),
      fetch(`/api/courses/${courseSlug}/assignments`).then((r) => r.json()),
    ])
      .then(([weeksBody, assignBody]) => {
        setWeeks(weeksBody.weeks ?? [])
        setItems(assignBody.assignments ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [courseSlug])

  function handleWeekChange(weekNo: number) {
    router.push(`?week=${weekNo}`)
  }

  const weekItems = items.filter((i) => i.weekNo === activeWeekNo)
  const summary = deriveScorebookSummary(weekItems)

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

      <SummaryBanner items={weekItems} />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 py-3 text-left">ลำดับ</th>
              <th className="px-5 py-3 text-left">ชื่อโจทย์</th>
              <th className="px-5 py-3 text-center">สถานะ</th>
              <th className="px-5 py-3 text-right">คะแนนที่ได้</th>
              <th className="px-5 py-3 text-right">เต็ม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {weekItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                  ยังไม่มีโจทย์ในรายวิชานี้
                </td>
              </tr>
            ) : (
              weekItems.map((item) => (
                <tr key={item.problemId} className="hover:bg-slate-50">
                  <td className="px-5 py-4 font-mono text-slate-400">{item.problemNo}</td>
                  <td className="px-5 py-4 font-semibold text-slate-700">{item.title}</td>
                  <td className="px-5 py-4 text-center">
                    <ScoreBadge item={item} />
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-slate-700">
                    {item.submission !== null
                      ? (item.submission.effectiveScore ?? 0)
                      : <span className="text-slate-300">–</span>}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-slate-500">
                    {item.pointsMax}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {weekItems.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={3} className="px-5 py-3 text-slate-500">รวม</td>
                <td className="px-5 py-3 text-right font-mono text-primary">{summary.earned}</td>
                <td className="px-5 py-3 text-right font-mono text-slate-500">{summary.max}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
