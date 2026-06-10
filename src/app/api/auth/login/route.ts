import { NextRequest, NextResponse } from "next/server"
import { createSessionToken } from "@/lib/auth"
import { verifyPassword } from "@/lib/password"
import { getDb } from "@/lib/db"
import { findUserByEmail } from "@/lib/users/repository"

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

  const sessionToken = createSessionToken({
    email: user.email,
    name: user.name,
    picture: user.picture ?? undefined,
  })

  const response = NextResponse.json({ ok: true })
  response.cookies.set("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  })

  return response
}
