import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { createUser, findUserByEmail, assignRole } from "@/lib/users/repository"
import { validateImportRows, type RawImportRow } from "@/lib/users/import"
import { hashPassword } from "@/lib/password"
import { safeLog } from "@/lib/logs"
import type { UserInput } from "@/lib/users/validation"

interface RowResult {
  row: number
  status: "created" | "error"
  email: string
  errors?: Record<string, string>
}

function displayName(input: UserInput): string {
  return `${input.firstNameTh.trim()} ${input.lastNameTh.trim()}`.trim()
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request)
  if (!guard.ok) return guard.response

  const body = (await request.json().catch(() => ({}))) as { rows?: RawImportRow[] }
  const rows = Array.isArray(body.rows) ? body.rows : []
  const validation = validateImportRows(rows)

  const db = getDb()
  const results: RowResult[] = []

  for (const r of validation) {
    if (!r.valid || !r.input) {
      results.push({ row: r.row, status: "error", email: r.input?.email ?? "", errors: r.errors })
      continue
    }

    const input = r.input
    if (await findUserByEmail(db, input.email)) {
      results.push({
        row: r.row,
        status: "error",
        email: input.email,
        errors: { email: "อีเมลนี้ถูกใช้งานแล้วในระบบ" },
      })
      continue
    }

    const passwordHash = input.password ? await hashPassword(input.password) : null
    const user = await createUser(db, {
      email: input.email,
      name: displayName(input),
      passwordHash,
      idCode: input.idCode,
      titleTh: input.titleTh,
      firstNameTh: input.firstNameTh,
      lastNameTh: input.lastNameTh,
      titleEn: input.titleEn,
      firstNameEn: input.firstNameEn,
      lastNameEn: input.lastNameEn,
      phone: input.phone,
    })
    for (const role of input.roles ?? []) {
      await assignRole(db, user.id, role)
    }
    await safeLog(db, {
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: "user.create",
      targetId: user.id,
      targetEmail: user.email,
    })
    results.push({ row: r.row, status: "created", email: user.email })
  }

  const created = results.filter((r) => r.status === "created").length
  return NextResponse.json({ results, created, failed: results.length - created })
}
