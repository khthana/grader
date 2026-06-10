"use client"

import { useState } from "react"
import { FaTimes } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"

const ROLES = ["Admin", "Instructor", "TA", "Student"] as const

interface Props {
  userId: number
  userName: string
  currentRoles: string[]
  onClose: () => void
  onSaved: () => void
}

export function RolesDialog({ userId, userName, currentRoles, onClose, onSaved }: Props) {
  const { notify } = useToast()
  const [roles, setRoles] = useState<string[]>(currentRoles)
  const [saving, setSaving] = useState(false)

  function toggle(role: string) {
    setRoles((r) => (r.includes(role) ? r.filter((x) => x !== role) : [...r, role]))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${userId}/roles`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roles }),
      })
      if (res.ok) {
        notify("success", "อัปเดตบทบาทแล้ว")
        onSaved()
        onClose()
        return
      }
      const body = await res.json().catch(() => ({}))
      notify("error", body?.errors?.roles ?? "ไม่สามารถอัปเดตบทบาทได้")
    } catch {
      notify("error", "เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 font-thai">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">จัดการบทบาท</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="ปิด">
            <FaTimes />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">{userName}</p>

        <div className="flex flex-col gap-2">
          {ROLES.map((role) => (
            <label
              key={role}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={roles.includes(role)}
                onChange={() => toggle(role)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {role}
            </label>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-100"
          >
            ยกเลิก
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  )
}
