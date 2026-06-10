import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { findUserByEmail, getUserWithRoles } from "@/lib/users/repository"

export async function GET(request: NextRequest) {
  const token = request.cookies.get("session")?.value
  const session = token ? verifySessionToken(token) : null

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const db = getDb()
  const user = await findUserByEmail(db, session.email)
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const withRoles = await getUserWithRoles(db, user.id)
  return NextResponse.json(withRoles)
}
