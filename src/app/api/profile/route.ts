import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { findUserByEmail, updateProfile } from "@/lib/users/repository"
import { validateProfileInput } from "@/lib/users/validation"

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const db = getDb()
  const record = await findUserByEmail(db, user.email)

  return NextResponse.json({
    email: user.email,
    name: user.name,
    nickname: user.nickname,
    picture: user.picture,
    roles: user.roles,
    hasPassword: record?.passwordHash != null,
  })
}

export async function PUT(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    nickname?: string | null
    picture?: string | null
  }

  const { valid, errors } = validateProfileInput({
    nickname: body.nickname,
    pictureBase64: body.picture ?? undefined,
  })
  if (!valid) return NextResponse.json({ errors }, { status: 400 })

  const changes: { nickname?: string | null; picture?: string | null } = {}
  if ("nickname" in body) changes.nickname = body.nickname ?? null
  if ("picture" in body) changes.picture = body.picture ?? null

  await updateProfile(getDb(), user.id, changes)
  return NextResponse.json({ ok: true })
}
