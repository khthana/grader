"use client"

import { useEffect, useState } from "react"
import { FaCheck, FaClock } from "react-icons/fa"

interface SubmissionItem {
  id: number
  userId: number
  studentName: string
  studentIdCode: string | null
  submittedAt: string
  isLate: boolean
  pointsEarned: number | null
  pointsMax: number | null
  manualScore: number | null
  effectiveScore: number | null
  reviewedAt: string | null
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

interface OverrideDialogProps {
  submission: SubmissionItem
  onClose: () => void
  onSave: (score: number | null) => void
}

function OverrideDialog({ submission, onClose, onSave }: OverrideDialogProps) {
  const [value, setValue] = useState(
    submission.manualScore != null ? String(submission.manualScore) : String(submission.pointsEarned ?? "")
  )
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
        <h2 className="mb-4 text-base font-semibold text-slate-800">
          ปรับคะแนน — {submission.studentName}
        </h2>
        <p className="mb-2 text-xs text-slate-500">
          คะแนนอัตโนมัติ: {submission.pointsEarned ?? "–"}/{submission.pointsMax ?? "–"}
        </p>
        <label className="mb-1 block text-sm font-medium text-slate-700">คะแนนที่ปรับเอง</label>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          min={0}
          max={submission.pointsMax ?? undefined}
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

interface SubmissionsTableProps {
  courseSlug: string
  problemId: number
  pointsMax: number
}

export function SubmissionsTable({ courseSlug, problemId, pointsMax }: SubmissionsTableProps) {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [overrideTarget, setOverrideTarget] = useState<SubmissionItem | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/courses/${courseSlug}/problems/${problemId}/submissions`)
    if (res.ok) {
      const data = await res.json()
      setSubmissions(data.submissions ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [courseSlug, problemId])

  async function handleOverrideSave(score: number | null) {
    if (!overrideTarget) return
    await fetch(`/api/courses/${courseSlug}/problems/${problemId}/submissions/${overrideTarget.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manualScore: score }),
    })
    setOverrideTarget(null)
    await load()
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white font-thai">
      <div className="border-b border-gray-100 px-5 py-3">
        <span className="text-sm font-medium text-slate-600">
          ผลการส่งงานทั้งหมด ({submissions.length} รายการ)
        </span>
      </div>

      {loading ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">กำลังโหลด...</div>
      ) : submissions.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">ยังไม่มีการส่งงาน</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 py-3 text-left">รหัสนักศึกษา</th>
              <th className="px-5 py-3 text-left">ชื่อ</th>
              <th className="px-5 py-3 text-left">เวลาส่ง</th>
              <th className="px-5 py-3 text-center">สถานะ</th>
              <th className="px-5 py-3 text-right">คะแนน ({pointsMax})</th>
              <th className="px-5 py-3 text-center">ตรวจแล้ว</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {submissions.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-500">
                  {s.studentIdCode ?? "–"}
                </td>
                <td className="px-5 py-3 text-slate-700">{s.studentName}</td>
                <td className="px-5 py-3 text-slate-500">{formatDate(s.submittedAt)}</td>
                <td className="px-5 py-3 text-center">
                  {s.isLate ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                      <FaClock className="h-2.5 w-2.5" /> ส่งช้า
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      <FaCheck className="h-2.5 w-2.5" /> ตรงเวลา
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right font-medium">
                  {s.manualScore != null ? (
                    <span className="text-blue-600">{s.manualScore}</span>
                  ) : (
                    <span className="text-slate-700">{s.pointsEarned ?? "–"}</span>
                  )}
                  {s.manualScore != null && (
                    <span className="ml-1 text-xs text-slate-400">(ปรับ)</span>
                  )}
                </td>
                <td className="px-5 py-3 text-center">
                  {s.reviewedAt ? (
                    <span className="text-xs text-green-600">✓</span>
                  ) : (
                    <span className="text-xs text-slate-300">–</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => setOverrideTarget(s)}
                    className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-blue-50 hover:text-secondary"
                  >
                    ปรับคะแนน
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {overrideTarget && (
        <OverrideDialog
          submission={overrideTarget}
          onClose={() => setOverrideTarget(null)}
          onSave={handleOverrideSave}
        />
      )}
    </div>
  )
}
