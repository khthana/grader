import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import {
  findUserByEmail,
  getUserById,
  updateUser,
  deleteUser,
  setUserActive,
} from "@/lib/users/repository"
import { validateUserInput, type UserInput } from "@/lib/users/validation"
import { safeLog } from "@/lib/logs"

type RouteContext = { params: Promise<{ id: string }> }

async function resolveId(context: RouteContext): Promise<number | null> {
  const { id } = await context.params
  const n = Number.parseInt(id, 10)
  return Number.isFinite(n) ? n : null
}

function displayName(input: UserInput): string {
  return `${input.firstNameTh.trim()} ${input.lastNameTh.trim()}`.trim()
}

// Full detail (for the edit form).
export async function GET(request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin(request)
  if (!guard.ok) return guard.response

  const id = await resolveId(context)
  if (id === null) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const detail = await getUserById(getDb(), id)
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(detail)
}

// Edit personal data.
export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin(request)
  if (!guard.ok) return guard.response

  const id = await resolveId(context)
  if (id === null) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Partial<UserInput>
  const input = {
    titleTh: body.titleTh,
    firstNameTh: body.firstNameTh ?? "",
    lastNameTh: body.lastNameTh ?? "",
    titleEn: body.titleEn,
    firstNameEn: body.firstNameEn,
    lastNameEn: body.lastNameEn,
    email: body.email ?? "",
    phone: body.phone,
    idCode: body.idCode ?? "",
  } satisfies UserInput

  const { valid, errors } = validateUserInput(input)
  if (!valid) return NextResponse.json({ errors }, { status: 400 })

  const db = getDb()
  const existing = await getUserById(db, id)
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const emailOwner = await findUserByEmail(db, input.email)
  if (emailOwner && emailOwner.id !== id) {
    return NextResponse.json({ errors: { email: "อีเมลนี้ถูกใช้งานแล้ว" } }, { status: 409 })
  }

  const updated = await updateUser(db, id, {
    email: input.email,
    name: displayName(input),
    idCode: input.idCode,
    phone: input.phone,
    titleTh: input.titleTh,
    firstNameTh: input.firstNameTh,
    lastNameTh: input.lastNameTh,
    titleEn: input.titleEn,
    firstNameEn: input.firstNameEn,
    lastNameEn: input.lastNameEn,
  })

  await safeLog(db, {
    actorId: guard.user.id,
    actorEmail: guard.user.email,
    action: "user.update",
    targetId: id,
    targetEmail: input.email,
  })

  return NextResponse.json(updated)
}

// Activate / deactivate.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin(request)
  if (!guard.ok) return guard.response

  const id = await resolveId(context)
  if (id === null) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as { isActive?: boolean }
  const updated = await setUserActive(getDb(), id, body.isActive === true)
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin(request)
  if (!guard.ok) return guard.response

  const id = await resolveId(context)
  if (id === null) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const db = getDb()
  const target = await getUserById(db, id)
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await deleteUser(db, id)
  await safeLog(db, {
    actorId: guard.user.id,
    actorEmail: guard.user.email,
    action: "user.delete",
    targetId: id,
    targetEmail: target.email,
  })
  return NextResponse.json({ ok: true })
}
