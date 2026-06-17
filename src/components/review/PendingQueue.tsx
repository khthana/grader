"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FaClock, FaCheck } from "react-icons/fa"

interface PendingItem {
  id: number
  problemId: number
  problemTitle: string
  weekNo: number
  userId: number
  studentName: string
  studentIdCode: string | null
  submittedAt: string
  isLate: boolean
  pointsEarned: number | null
  pointsMax: number | null
}

interface OverrideDialogProps {
  item: PendingItem
  onClose: () => void
  onSave: (score: number | null) => void
}

function OverrideDialog({ item, onClose, onSave }: OverrideDialogProps) {
  const [value, setValue] = useState(item.pointsEarned != null ? String(item.pointsEarned) : "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const parsed = value.trim() === "" ? null : Number(value)
    await onSave(parsed)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 font-thai">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-base font-semibold text-slate-800">ตรวจงาน</h2>
        <p className="mb-1 text-sm text-slate-500">{item.problemTitle} — {item.studentName}</p>
        <p className="mb-4 text-xs text-slate-400">
          คะแนนอัตโนมัติ: {item.pointsEarned ?? "–"}/{item.pointsMax ?? "–"}
        </p>
        <label className="mb-1 block text-sm font-medium text-slate-700">คะแนนที่ปรับเอง</label>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          min={0}
          max={item.pointsMax ?? undefined}
          className="input-base mb-4 w-full"
          placeholder="ปล่อยว่างเพื่อใช้คะแนนอัตโนมัติ"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function PendingQueue({ courseId }: { courseId: number }) {
  const [items, setItems] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewTarget, setReviewTarget] = useState<PendingItem | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/courses/${courseId}/review`)
    if (res.ok) {
      const data = await res.json()
      setItems(data.submissions ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [courseId])

  async function handleSave(score: number | null) {
    if (!reviewTarget) return
    await fetch(
      `/api/courses/${courseId}/problems/${reviewTarget.problemId}/submissions/${reviewTarget.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manualScore: score }),
      }
    )
    setReviewTarget(null)
    await load()
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-400 font-thai">กำลังโหลด...</div>
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-16 text-center font-thai">
        <FaCheck className="mx-auto mb-3 h-8 w-8 text-green-400" />
        <p className="text-sm font-medium text-slate-500">ไม่มีงานที่รอตรวจ</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white font-thai">
      <div className="border-b border-gray-100 px-5 py-3">
        <span className="text-sm font-medium text-slate-600">
          รอตรวจ{" "}
          <span className="ml-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
            {items.length}
          </span>
        </span>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-5 py-3 text-left">โจทย์</th>
            <th className="px-5 py-3 text-left">นักศึกษา</th>
            <th className="px-5 py-3 text-left">เวลาส่ง</th>
            <th className="px-5 py-3 text-center">สถานะ</th>
            <th className="px-5 py-3 text-right">คะแนน</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-5 py-4">
                <p className="font-medium text-slate-700">{item.problemTitle}</p>
                <p className="text-xs text-slate-400">สัปดาห์ {item.weekNo}</p>
              </td>
              <td className="px-5 py-4">
                <p className="text-slate-700">{item.studentName}</p>
                <p className="font-mono text-xs text-slate-400">{item.studentIdCode ?? "–"}</p>
              </td>
              <td className="px-5 py-4 text-slate-500">{formatDate(item.submittedAt)}</td>
              <td className="px-5 py-4 text-center">
                {item.isLate ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                    <FaClock className="h-2.5 w-2.5" /> ส่งช้า
                  </span>
                ) : (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    ตรงเวลา
                  </span>
                )}
              </td>
              <td className="px-5 py-4 text-right font-medium text-slate-700">
                {item.pointsEarned ?? "–"}/{item.pointsMax ?? "–"}
              </td>
              <td className="px-5 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/problems/${item.problemId}/submissions?courseId=${courseId}`}
                    className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    ดูทั้งหมด
                  </Link>
                  <button
                    onClick={() => setReviewTarget(item)}
                    className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover"
                  >
                    ตรวจ
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {reviewTarget && (
        <OverrideDialog
          item={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
