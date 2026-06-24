"use client"

import { useState } from "react"
import { FaTimes } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"
import type { CourseValue } from "./CourseFormDialog"

interface Props {
  source: CourseValue
  onClose: () => void
  onSaved: () => void
}

export function CourseDuplicateDialog({ source, onClose, onSaved }: Props) {
  const { notify } = useToast()
  const [year, setYear] = useState(String(source.year))
  const [semester, setSemester] = useState(String(source.semester === 3 ? 1 : source.semester + 1))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/courses/${source.code}/${source.year}/${source.semester}/duplicate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ year: Number(year), semester: Number(semester) }),
        }
      )
      if (res.ok) {
        notify("success", "ทำซ้ำรายวิชาไปภาคใหม่แล้ว")
        onSaved()
        onClose()
        return
      }
      const body = await res.json().catch(() => ({}))
      if (res.status === 409) setError("มีรายวิชาในปี/ภาคการศึกษานี้อยู่แล้ว")
      else if (res.status === 400) setError(body.error ?? "ปี/ภาคการศึกษาปลายทางไม่ถูกต้อง")
      else notify("error", "เกิดข้อผิดพลาด ไม่สามารถทำซ้ำได้")
    } catch {
      notify("error", "เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 font-thai">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">ทำซ้ำไปภาคใหม่</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="ปิด">
            <FaTimes />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          คัดลอกโจทย์ เฉลย และ test cases ทั้งหมดของ{" "}
          <span className="font-medium text-slate-700">
            {source.code} · {source.nameTh}
          </span>{" "}
          ({source.year}/{source.semester}) ไปยังภาคการศึกษาใหม่
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500">ปีการศึกษาปลายทาง (พ.ศ.) *</label>
            <input
              type="text"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500">ภาคการศึกษาปลายทาง *</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-100"
          >
            ยกเลิก
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {submitting ? "กำลังทำซ้ำ..." : "ทำซ้ำ"}
          </button>
        </div>
      </div>
    </div>
  )
}
