"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FaUser } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"

interface Props {
  email: string
  name: string
  nickname: string | null
  picture: string | null
  activeRole: string
  hasPassword: boolean
}

export function ProfileForm({ email, name, nickname: initialNickname, picture: initialPicture, activeRole, hasPassword }: Props) {
  const { notify } = useToast()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [nickname, setNickname] = useState(initialNickname ?? "")
  const [picture, setPicture] = useState<string | null>(initialPicture)
  const [saving, setSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPwd, setSavingPwd] = useState(false)

  function resizeToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement("canvas")
        canvas.width = 256
        canvas.height = 256
        const ctx = canvas.getContext("2d")!
        const size = Math.min(img.width, img.height)
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256)
        resolve(canvas.toDataURL("image/jpeg", 0.85))
      }
      img.onerror = reject
      img.src = url
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const b64 = await resizeToBase64(file)
      // Rough byte-length check: base64 chars * 3/4
      const approxBytes = (b64.length - b64.indexOf(",") - 1) * 3 / 4
      if (approxBytes > 150 * 1024) {
        notify("error", "รูปภาพต้องมีขนาดไม่เกิน 150KB หลังจาก resize")
        return
      }
      setPicture(b64)
    } catch {
      notify("error", "ไม่สามารถประมวลผลรูปภาพได้")
    }
  }

  async function handleSaveInfo() {
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() || null, picture }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = data?.errors?.nickname ?? data?.errors?.pictureBase64 ?? "บันทึกไม่สำเร็จ"
        notify("error", msg)
        return
      }
      notify("success", "บันทึกข้อมูลเรียบร้อย")
      router.refresh()
    } catch {
      notify("error", "เกิดข้อผิดพลาด กรุณาลองใหม่")
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePassword() {
    setSavingPwd(true)
    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data?.error ?? Object.values(data?.errors ?? {})[0] ?? "บันทึกไม่สำเร็จ"
        notify("error", msg as string)
        return
      }
      notify("success", "เปลี่ยนรหัสผ่านเรียบร้อย")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      notify("error", "เกิดข้อผิดพลาด กรุณาลองใหม่")
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Section 1 — ข้อมูลทั่วไป */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 font-thai text-lg font-semibold text-slate-700">ข้อมูลทั่วไป</h2>

        {/* Avatar */}
        <div className="mb-6 flex items-center gap-5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 hover:opacity-80"
          >
            {picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={picture} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                <FaUser className="h-8 w-8" />
              </span>
            )}
          </button>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-thai text-sm text-slate-700 hover:bg-slate-50"
            >
              เปลี่ยนรูปโปรไฟล์
            </button>
            <p className="mt-1 font-thai text-xs text-slate-400">JPEG/PNG — resize อัตโนมัติ 256×256px, ≤150KB</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Read-only fields */}
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-thai text-xs font-medium text-slate-500">อีเมล</label>
            <p className="rounded-lg bg-slate-50 px-3 py-2 font-thai text-sm text-slate-700">{email}</p>
          </div>
          <div>
            <label className="mb-1 block font-thai text-xs font-medium text-slate-500">ชื่อทางการ</label>
            <p className="rounded-lg bg-slate-50 px-3 py-2 font-thai text-sm text-slate-700">{name}</p>
          </div>
          <div>
            <label className="mb-1 block font-thai text-xs font-medium text-slate-500">บทบาท</label>
            <p className="rounded-lg bg-slate-50 px-3 py-2 font-thai text-sm text-slate-700">{activeRole}</p>
          </div>
        </div>

        {/* Editable: nickname */}
        <div className="mb-5">
          <label className="mb-1 block font-thai text-sm font-medium text-slate-700">
            ชื่อเล่น <span className="text-slate-400">(แสดงใน navbar แทนชื่อทางการ)</span>
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={50}
            placeholder="ว่างไว้ = แสดงชื่อทางการ"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-thai text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <button
          type="button"
          onClick={handleSaveInfo}
          disabled={saving}
          className="rounded-lg bg-primary px-5 py-2 font-thai text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
        </button>
      </section>

      {/* Section 2 — เปลี่ยนรหัสผ่าน */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 font-thai text-lg font-semibold text-slate-700">เปลี่ยนรหัสผ่าน</h2>
        {!hasPassword && (
          <p className="mb-4 font-thai text-sm text-slate-400">
            บัญชีนี้ใช้ Google Sign-In — ไม่สามารถตั้งรหัสผ่านได้
          </p>
        )}
        <div className={`space-y-4 ${!hasPassword ? "pointer-events-none opacity-40" : ""}`}>
          <div>
            <label className="mb-1 block font-thai text-sm font-medium text-slate-700">รหัสผ่านเดิม</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={!hasPassword}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-thai text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block font-thai text-sm font-medium text-slate-700">รหัสผ่านใหม่</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={!hasPassword}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-thai text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block font-thai text-sm font-medium text-slate-700">ยืนยันรหัสผ่านใหม่</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={!hasPassword}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-thai text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="button"
            onClick={handleSavePassword}
            disabled={!hasPassword || savingPwd}
            className="rounded-lg bg-primary px-5 py-2 font-thai text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {savingPwd ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
          </button>
        </div>
      </section>
    </div>
  )
}
