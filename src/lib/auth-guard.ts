import { NextResponse, type NextRequest } from "next/server"
import { verifySessionToken } from "./auth"
import { getDb } from "./db"
import { findUserByEmail, getUserWithRoles, type UserWithRoles } from "./users/repository"

// Resolve the signed-in user (with roles) from a request's session cookie.
// Request-based so route handlers stay unit-testable with a plain NextRequest.
export async function getUserFromRequest(
  request: NextRequest
): Promise<UserWithRoles | null> {
  const token = request.cookies.get("session")?.value
  const session = token ? verifySessionToken(token) : null
  if (!session) return null

  const db = getDb()
  const user = await findUserByEmail(db, session.email)
  if (!user) return null
  return getUserWithRoles(db, user.id)
}

type AdminGuard =
  | { ok: true; user: UserWithRoles }
  | { ok: false; response: NextResponse }

// Admin-only gate for route handlers: 401 if not signed in, 403 if not Admin.
export async function requireAdmin(request: NextRequest): Promise<AdminGuard> {
  const user = await getUserFromRequest(request)
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) }
  }
  if (!user.roles.includes("Admin")) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true, user }
}
