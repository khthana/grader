"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export interface Week {
  id: number
  weekNo: number
  topic: string
}

interface Props {
  weeks: Week[]
  activeWeekNo: number
  courseId: number
  canManage: boolean
  onWeekChange: (weekNo: number) => void
}

export function WeekBar({ weeks, activeWeekNo, courseId, canManage, onWeekChange }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  async function saveTopic(week: Week) {
    if (!draft.trim() || draft === week.topic) { setEditing(null); return }
    setSaving(true)
    await fetch(`/api/courses/${courseId}/weeks/${week.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: draft.trim() }),
    })
    setSaving(false)
    setEditing(null)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">สัปดาห์</span>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {weeks.map((w) => {
          const active = w.weekNo === activeWeekNo
          return (
            <button
              key={w.id}
              onClick={() => onWeekChange(w.weekNo)}
              className={[
                "flex min-w-[122px] flex-col rounded-lg border px-3 py-2 text-left transition-colors",
                active
                  ? "border-primary bg-primary text-white"
                  : "border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50",
              ].join(" ")}
            >
              <span className={`text-[13px] font-bold ${active ? "text-white" : "text-slate-700"}`}>
                สัปดาห์ {w.weekNo}
              </span>
              {editing === w.id && canManage ? (
                <input
                  autoFocus
                  className="mt-0.5 w-full rounded border border-blue-300 bg-white px-1 text-[11.5px] text-slate-700"
                  value={draft}
                  disabled={saving}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => saveTopic(w)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTopic(w)
                    if (e.key === "Escape") setEditing(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className={`mt-0.5 truncate text-[11.5px] ${active ? "text-white/85" : "text-slate-400"}`}
                  onDoubleClick={
                    canManage
                      ? (e) => { e.stopPropagation(); setDraft(w.topic); setEditing(w.id) }
                      : undefined
                  }
                  title={canManage ? "ดับเบิลคลิกเพื่อแก้ไขหัวข้อ" : undefined}
                >
                  {w.topic || `สัปดาห์ที่ ${w.weekNo}`}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
