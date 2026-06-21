"use client"

import { useRef, useState } from "react"
import { FaPlus, FaTrash, FaLock, FaLockOpen } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"

export interface Week {
  id: number
  weekNo: number
  topic: string
  isReleased: boolean
}

const MAX_WEEKS = 16

interface Props {
  weeks: Week[]
  activeWeekNo: number
  courseSlug: string
  canManage: boolean
  onWeekChange: (weekNo: number) => void
  onWeeksChanged: () => void
}

export function WeekBar({
  weeks,
  activeWeekNo,
  courseSlug,
  canManage,
  onWeekChange,
  onWeeksChanged,
}: Props) {
  const { notify } = useToast()
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  // Guards the edit commit so an Enter keypress + the subsequent blur don't both
  // fire a save (and so Escape can cancel without the blur re-saving).
  const committedRef = useRef(false)

  function beginEdit(week: Week) {
    setDraft(week.topic)
    setEditing(week.id)
    committedRef.current = false
  }

  function cancelEdit() {
    committedRef.current = true
    setEditing(null)
  }

  async function commitTopic(week: Week) {
    if (committedRef.current) return
    committedRef.current = true
    setEditing(null)

    const topic = draft.trim()
    if (topic === week.topic.trim()) return

    const res = await fetch(`/api/courses/${courseSlug}/weeks/${week.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic }),
    })
    if (res.ok) {
      onWeeksChanged()
    } else {
      notify("error", "บันทึกหัวข้อไม่สำเร็จ")
    }
  }

  async function addWeek() {
    setBusy(true)
    const res = await fetch(`/api/courses/${courseSlug}/weeks`, { method: "POST" })
    setBusy(false)
    if (res.ok) {
      onWeeksChanged()
    } else {
      const body = await res.json().catch(() => ({}))
      notify("error", body.error || "เพิ่มสัปดาห์ไม่สำเร็จ")
    }
  }

  async function toggleRelease(week: Week) {
    const res = await fetch(`/api/courses/${courseSlug}/weeks/${week.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isReleased: !week.isReleased }),
    })
    if (res.ok) {
      onWeeksChanged()
    } else {
      notify("error", "เปลี่ยนสถานะสัปดาห์ไม่สำเร็จ")
    }
  }

  async function removeWeek(week: Week) {
    setBusy(true)
    const res = await fetch(`/api/courses/${courseSlug}/weeks/${week.id}`, {
      method: "DELETE",
    })
    setBusy(false)
    if (res.ok) {
      onWeeksChanged()
    } else {
      const body = await res.json().catch(() => ({}))
      notify("error", body.error || "ลบสัปดาห์ไม่สำเร็จ")
    }
  }

  const lastWeekNo = weeks.length ? weeks[weeks.length - 1].weekNo : 0

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">สัปดาห์</span>
      <div className="grid grid-cols-6 gap-2">
        {weeks.map((w) => {
          const active = w.weekNo === activeWeekNo
          const isLast = canManage && w.weekNo === lastWeekNo && weeks.length > 1
          return (
            <div key={w.id} className="relative">
              <div
                role="button"
                tabIndex={0}
                onClick={() => editing !== w.id && onWeekChange(w.weekNo)}
                onKeyDown={(e) => {
                  if (editing === w.id) return
                  if (e.key === "Enter" || e.key === " ") onWeekChange(w.weekNo)
                }}
                className={[
                  "flex w-full cursor-pointer flex-col rounded-lg border px-3 py-2 text-left transition-colors",
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
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitTopic(w)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur()
                      if (e.key === "Escape") cancelEdit()
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className={[
                      "mt-0.5 truncate text-[11.5px]",
                      w.topic
                        ? active
                          ? "text-white/85"
                          : "text-slate-400"
                        : active
                          ? "italic text-white/60"
                          : "italic text-slate-300",
                    ].join(" ")}
                    onDoubleClick={
                      canManage
                        ? (e) => { e.stopPropagation(); beginEdit(w) }
                        : undefined
                    }
                    title={w.topic || (canManage ? "ดับเบิลคลิกเพื่อเพิ่มหัวข้อ" : undefined)}
                  >
                    {w.topic || (canManage ? "เพิ่มหัวข้อ" : "—")}
                  </span>
                )}
              </div>
              {isLast && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeWeek(w)}
                  title="ลบสัปดาห์สุดท้าย"
                  className={[
                    "absolute -right-1.5 -top-1.5 rounded-full border p-1 text-[10px] shadow-sm transition disabled:opacity-50",
                    "border-gray-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600",
                  ].join(" ")}
                >
                  <FaTrash className="h-2.5 w-2.5" />
                </button>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleRelease(w) }}
                  title={w.isReleased ? "ซ่อนสัปดาห์นี้" : "ปล่อยสัปดาห์นี้"}
                  className={[
                    "absolute left-1 top-1 rounded p-0.5 text-[10px] transition",
                    w.isReleased
                      ? "text-green-500 hover:text-green-700"
                      : "text-slate-300 hover:text-slate-500",
                  ].join(" ")}
                >
                  {w.isReleased
                    ? <FaLockOpen className="h-2.5 w-2.5" />
                    : <FaLock className="h-2.5 w-2.5" />
                  }
                </button>
              )}
            </div>
          )
        })}

        {canManage && weeks.length < MAX_WEEKS && (
          <button
            type="button"
            disabled={busy}
            onClick={addWeek}
            className="flex min-h-[58px] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-white text-slate-400 transition hover:border-blue-300 hover:bg-blue-50 hover:text-secondary disabled:opacity-50"
          >
            <FaPlus className="h-3 w-3" />
            <span className="text-[11px]">เพิ่มสัปดาห์</span>
          </button>
        )}
      </div>
    </div>
  )
}
