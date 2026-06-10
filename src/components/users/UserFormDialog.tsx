"use client"

import { useEffect, useState } from "react"
import { FaTimes } from "react-icons/fa"
import { validateUserInput, type UserInput } from "@/lib/users/validation"
import { resolveNameFields } from "@/lib/users/name"
import { useToast } from "@/components/shell/ToastProvider"

const ROLES = ["Admin", "Instructor", "TA", "Student"] as const

type FormState = {
  titleTh: string
  firstNameTh: string
  lastNameTh: string
  titleEn: string
  firstNameEn: string
  lastNameEn: string
  email: string
  phone: string
  idCode: string
  password: string
  roles: string[]
}

const EMPTY: FormState = {
  titleTh: "",
  firstNameTh: "",
  lastNameTh: "",
  titleEn: "",
  firstNameEn: "",
  lastNameEn: "",
  email: "",
  phone: "",
  idCode: "",
  password: "",
  roles: [],
}

interface Props {
  mode: "create" | "edit"
  userId?: number
  onClose: () => void
  onSaved: () => void
}

export function UserFormDialog({ mode, userId, onClose, onSaved }: Props) {
  const { notify } = useToast()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(mode === "edit")

  useEffect(() => {
    if (mode !== "edit" || userId == null) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/users/${userId}`)
        if (!res.ok) throw new Error()
        const d = await res.json()
        if (cancelled) return
        const { firstNameTh, lastNameTh } = resolveNameFields(d)
        setForm({
          titleTh: d.titleTh ?? "",
          firstNameTh,
          lastNameTh,
          titleEn: d.titleEn ?? "",
          firstNameEn: d.firstNameEn ?? "",
          lastNameEn: d.lastNameEn ?? "",
          email: d.email ?? "",
          phone: d.phone ?? "",
          idCode: d.idCode ?? "",
          password: "",
          roles: d.roles ?? [],
        })
      } catch {
        if (!cancelled) notify("error", "ไม่สามารถโหลดข้อมูลผู้ใช้ได้")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [mode, userId, notify])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleRole(role: string) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }))
  }

  async function submit() {
    const input: UserInput = {
      titleTh: form.titleTh || undefined,
      firstNameTh: form.firstNameTh,
      lastNameTh: form.lastNameTh,
      titleEn: form.titleEn || undefined,
      firstNameEn: form.firstNameEn || undefined,
      lastNameEn: form.lastNameEn || undefined,
      email: form.email,
      phone: form.phone || undefined,
      idCode: form.idCode,
      password: mode === "create" && form.password ? form.password : undefined,
      roles: mode === "create" ? form.roles : undefined,
    }

    const { valid, errors: validationErrors } = validateUserInput(input)
    if (!valid) {
      setErrors(validationErrors)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(mode === "create" ? "/api/users" : `/api/users/${userId}`, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      })
      if (res.ok) {
        notify("success", mode === "create" ? "เพิ่มผู้ใช้สำเร็จ" : "บันทึกข้อมูลสำเร็จ")
        onSaved()
        onClose()
        return
      }
      const body = await res.json().catch(() => ({}))
      if (res.status === 400 || res.status === 409) {
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
            {mode === "create" ? "เพิ่มผู้ใช้ใหม่" : "แก้ไขข้อมูลผู้ใช้"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="ปิด">
            <FaTimes />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">กำลังโหลด...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="คำนำหน้า (ไทย)">
              <Input value={form.titleTh} onChange={(v) => set("titleTh", v)} />
            </Field>
            <div className="hidden sm:block" />
            <Field label="ชื่อ (ไทย) *" error={errors.firstNameTh}>
              <Input value={form.firstNameTh} onChange={(v) => set("firstNameTh", v)} error={!!errors.firstNameTh} />
            </Field>
            <Field label="นามสกุล (ไทย) *" error={errors.lastNameTh}>
              <Input value={form.lastNameTh} onChange={(v) => set("lastNameTh", v)} error={!!errors.lastNameTh} />
            </Field>
            <Field label="ชื่อ (อังกฤษ)">
              <Input value={form.firstNameEn} onChange={(v) => set("firstNameEn", v)} />
            </Field>
            <Field label="นามสกุล (อังกฤษ)">
              <Input value={form.lastNameEn} onChange={(v) => set("lastNameEn", v)} />
            </Field>
            <Field label="อีเมล *" error={errors.email}>
              <Input value={form.email} onChange={(v) => set("email", v)} error={!!errors.email} />
            </Field>
            <Field label="รหัส (นักศึกษา/พนักงาน) *" error={errors.idCode}>
              <Input value={form.idCode} onChange={(v) => set("idCode", v)} error={!!errors.idCode} />
            </Field>
            <Field label="เบอร์โทร">
              <Input value={form.phone} onChange={(v) => set("phone", v)} />
            </Field>
            {mode === "create" && (
              <Field label="รหัสผ่าน (ถ้ามี)" error={errors.password}>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(v) => set("password", v)}
                  error={!!errors.password}
                />
              </Field>
            )}

            {mode === "create" && (
              <div className="sm:col-span-2">
                <span className="text-sm text-gray-500">บทบาท</span>
                <div className="mt-2 flex flex-wrap gap-3">
                  {ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={form.roles.includes(role)}
                        onChange={() => toggleRole(role)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {role}
                    </label>
                  ))}
                </div>
                {errors.roles && <p className="mt-1 text-xs text-red-600">{errors.roles}</p>}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-100"
          >
            ยกเลิก
          </button>
          <button
            onClick={submit}
            disabled={submitting || loading}
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
  type = "text",
  error,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  error?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`mt-1 w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm transition focus:border-transparent focus:outline-none focus:ring-2 ${
        error ? "border-red-300 focus:ring-red-400" : "border-slate-200 focus:ring-blue-500"
      }`}
    />
  )
}
