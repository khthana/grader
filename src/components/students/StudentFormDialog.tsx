"use client"

import { useState } from "react"
import { FaTimes } from "react-icons/fa"
import { validateEnrollInput } from "@/lib/enrollments/validation"
import { useToast } from "@/components/shell/ToastProvider"

const TITLES = ["นาย", "นางสาว", "นาง"] as const

type FormState = {
  idCode: string
  titleTh: string
  firstNameTh: string
  lastNameTh: string
  studyGroup: string
  year: string
  program: string
  email: string
}

const EMPTY: FormState = {
  idCode: "",
  titleTh: "นาย",
  firstNameTh: "",
  lastNameTh: "",
  studyGroup: "",
  year: "",
  program: "",
  email: "",
}

export interface RosterRowValue {
  id: number
  sid: string | null
  prefix: string | null
  name: string
  program: string | null
  studyGroup: string | null
  year: string | null
}

function splitName(name: string): { firstNameTh: string; lastNameTh: string } {
  const parts = name.trim().split(/\s+/)
  return { firstNameTh: parts[0] ?? "", lastNameTh: parts.slice(1).join(" ") }
}

function initialForm(enrollment?: RosterRowValue): FormState {
  if (!enrollment) return EMPTY
  const { firstNameTh, lastNameTh } = splitName(enrollment.name)
  return {
    idCode: enrollment.sid ?? "",
    titleTh: enrollment.prefix || "นาย",
    firstNameTh,
    lastNameTh,
    studyGroup: enrollment.studyGroup ?? "",
    year: enrollment.year ?? "",
    program: enrollment.program ?? "",
    email: "",
  }
}

interface Props {
  courseId: number
  enrollment?: RosterRowValue
  onClose: () => void
  onSaved: () => void
}

export function StudentFormDialog({ courseId, enrollment, onClose, onSaved }: Props) {
  const { notify } = useToast()
  const isEdit = enrollment != null
  const [form, setForm] = useState<FormState>(() => initialForm(enrollment))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit() {
    const { valid, errors: validationErrors } = validateEnrollInput({
      idCode: form.idCode,
      firstNameTh: form.firstNameTh,
      lastNameTh: form.lastNameTh,
      email: form.email,
    })
    if (!valid) {
      setErrors(validationErrors)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(
        isEdit
          ? `/api/courses/${courseId}/students/${enrollment!.id}`
          : `/api/courses/${courseId}/students`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            idCode: form.idCode,
            titleTh: form.titleTh || undefined,
            firstNameTh: form.firstNameTh,
            lastNameTh: form.lastNameTh,
            studyGroup: form.studyGroup || undefined,
            year: form.year || undefined,
            program: form.program || undefined,
            email: isEdit ? undefined : form.email || undefined,
          }),
        }
      )
      if (res.ok) {
        notify("success", isEdit ? "บันทึกข้อมูลสำเร็จ" : "เพิ่มนักศึกษาสำเร็จ")
        onSaved()
        onClose()
        return
      }
      const body = await res.json().catch(() => ({}))
      if (res.status === 409) {
        setErrors({ idCode: body.error ?? "รหัสนี้อยู่ในรายวิชาแล้ว" })
      } else if (res.status === 400) {
        setErrors(body.errors ?? {})
      } else {
        notify("error", "เกิดข้อผิดพลาด ไม่สามารถบันทึกได้")
      }
    } catch {
      notify("error", "เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 font-thai">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">
            {isEdit ? "แก้ไขข้อมูลนักศึกษา" : "เพิ่มนักศึกษา"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="ปิด">
            <FaTimes />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="รหัสนักศึกษา *" error={errors.idCode}>
            <Input
              value={form.idCode}
              onChange={(v) => set("idCode", v)}
              error={!!errors.idCode}
              readOnly={isEdit}
            />
          </Field>
          <Field label="คำนำหน้า">
            <select
              value={form.titleTh}
              onChange={(e) => set("titleTh", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TITLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ชื่อ *" error={errors.firstNameTh}>
            <Input value={form.firstNameTh} onChange={(v) => set("firstNameTh", v)} error={!!errors.firstNameTh} />
          </Field>
          <Field label="นามสกุล *" error={errors.lastNameTh}>
            <Input value={form.lastNameTh} onChange={(v) => set("lastNameTh", v)} error={!!errors.lastNameTh} />
          </Field>
          <Field label="กลุ่มเรียน">
            <Input value={form.studyGroup} onChange={(v) => set("studyGroup", v)} />
          </Field>
          <Field label="ปีการศึกษา">
            <Input value={form.year} onChange={(v) => set("year", v)} />
          </Field>
          <Field label="หลักสูตร (ถ้าเว้นว่างจะใช้ค่าของรายวิชา)">
            <Input value={form.program} onChange={(v) => set("program", v)} />
          </Field>
          {!isEdit && (
            <Field label="อีเมล (ถ้าเว้นว่างจะสร้างจากรหัส)" error={errors.email}>
              <Input value={form.email} onChange={(v) => set("email", v)} error={!!errors.email} />
            </Field>
          )}
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
  readOnly,
}: {
  value: string
  onChange: (v: string) => void
  error?: boolean
  readOnly?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      className={`mt-1 w-full rounded-xl border px-4 py-2.5 text-sm transition focus:border-transparent focus:outline-none focus:ring-2 ${
        readOnly
          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
          : "bg-slate-50"
      } ${error ? "border-red-300 focus:ring-red-400" : "border-slate-200 focus:ring-blue-500"}`}
    />
  )
}
