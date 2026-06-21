import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { findUserByEmail, updatePasswordHash } from "@/lib/users/repository"
import { verifyPassword, hashPassword } from "@/lib/password"
import { validatePasswordChange } from "@/lib/users/validation"

export async function PUT(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const db = getDb()
  const record = await findUserByEmail(db, user.email)
  if (!record?.passwordHash) {
    return NextResponse.json({ error: "บัญชีนี้ใช้ Google Sign-In — ไม่สามารถเปลี่ยนรหัสผ่านได้" }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }

  const { valid, errors } = validatePasswordChange({
    currentPassword: body.currentPassword ?? "",
    newPassword: body.newPassword ?? "",
    confirmPassword: body.confirmPassword ?? "",
  })
  if (!valid) return NextResponse.json({ errors }, { status: 400 })

  const currentOk = await verifyPassword(body.currentPassword!, record.passwordHash)
  if (!currentOk) {
    return NextResponse.json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" }, { status: 400 })
  }

  const newHash = await hashPassword(body.newPassword!)
  await updatePasswordHash(db, user.id, newHash)

  return NextResponse.json({ ok: true })
}
