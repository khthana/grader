"use client"

import { useState } from "react"
import { FaTimes } from "react-icons/fa"
import { validateCourseInput } from "@/lib/courses/validation"
import { useToast } from "@/components/shell/ToastProvider"

export interface CourseValue {
  id: number
  code: string
  nameTh: string
  nameEn: string
  program: string | null
}

type FormState = { code: string; nameTh: string; nameEn: string; program: string }

interface Props {
  course?: CourseValue
  onClose: () => void
  onSaved: () => void
}

export function CourseFormDialog({ course, onClose, onSaved }: Props) {
  const { notify } = useToast()
  const isEdit = course != null
  const [form, setForm] = useState<FormState>({
    code: course?.code ?? "",
    nameTh: course?.nameTh ?? "",
    nameEn: course?.nameEn ?? "",
    program: course?.program ?? "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit() {
    const { valid, errors: ve } = validateCourseInput(form)
    if (!valid) {
      setErrors(ve)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(isEdit ? `/api/courses/${course!.id}` : "/api/courses", {
        method: isEdit ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          nameTh: form.nameTh,
          nameEn: form.nameEn,
          program: form.program || undefined,
        }),
      })
      if (res.ok) {
        notify("success", isEdit ? "บันทึกรายวิชาแล้ว" : "เพิ่มรายวิชาแล้ว")
        onSaved()
        onClose()
        return
      }
      const body = await res.json().catch(() => ({}))
      if (res.status === 400 || res.status === 409) setErrors(body.errors ?? {})
      else notify("error", "เกิดข้อผิดพลาด ไม่สามารถบันทึกได้")
    } catch {
      notify("error", "เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 font-thai">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">
            {isEdit ? "แก้ไขรายวิชา" : "เพิ่มรายวิชา"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="ปิด">
            <FaTimes />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Field label="รหัสวิชา *" error={errors.code}>
            <Input value={form.code} onChange={(v) => set("code", v)} error={!!errors.code} />
          </Field>
          <Field label="ชื่อวิชา (ภาษาไทย) *" error={errors.nameTh}>
            <Input value={form.nameTh} onChange={(v) => set("nameTh", v)} error={!!errors.nameTh} />
          </Field>
          <Field label="ชื่อวิชา (ภาษาอังกฤษ) *" error={errors.nameEn}>
            <Input value={form.nameEn} onChange={(v) => set("nameEn", v)} error={!!errors.nameEn} />
          </Field>
          <Field label="หลักสูตร (ค่าเริ่มต้นของนักศึกษาในวิชา)">
            <Input value={form.program} onChange={(v) => set("program", v)} />
          </Field>
        </div>

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
            {submitting ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm text-gray-500">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function Input({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (v: string) => void
  error?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`mt-1 w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm transition focus:border-transparent focus:outline-none focus:ring-2 ${
        error ? "border-red-300 focus:ring-red-400" : "border-slate-200 focus:ring-blue-500"
      }`}
    />
  )
}
