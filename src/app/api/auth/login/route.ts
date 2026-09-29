import { NextRequest, NextResponse } from "next/server"
import { createSessionToken, SESSION_COOKIE_OPTIONS } from "@/lib/auth"
import { verifyPassword } from "@/lib/password"
import { getDb } from "@/lib/db"
import { findUserByEmail } from "@/lib/users/repository"
import { safeLog } from "@/lib/logs"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = body?.email?.toString().trim() ?? ""
  const password = body?.password?.toString() ?? ""

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    )
  }

  const user = await findUserByEmail(getDb(), email)
  if (!user) {
    return NextResponse.json(
      { error: "Your account is not registered" },
      { status: 403 }
    )
  }

  if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    )
  }

  // Checked after the password so an inactive account's status is only
  // revealed to someone who knows its password (#75).
  if (!user.isActive) {
    return NextResponse.json(
      { error: "Your account has been deactivated", reason: "inactive" },
      { status: 403 }
    )
  }

  const sessionToken = createSessionToken({
    email: user.email,
    name: user.name,
    picture: user.picture ?? undefined,
  })

  await safeLog(getDb(), {
    actorId: user.id,
    actorEmail: user.email,
    action: "login",
    targetId: user.id,
    targetEmail: user.email,
  })

  const response = NextResponse.json({ ok: true })
  response.cookies.set("session", sessionToken, SESSION_COOKIE_OPTIONS)

  return response
}
