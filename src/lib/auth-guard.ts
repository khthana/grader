import { NextResponse, type NextRequest } from "next/server"
import { resolveSessionUser } from "./session-user"
import type { UserWithRoles } from "./users/repository"

// Resolve the signed-in user (with roles) from a request's session cookie.
// Request-based so route handlers stay unit-testable with a plain NextRequest.
export async function getUserFromRequest(
  request: NextRequest
): Promise<UserWithRoles | null> {
  return resolveSessionUser(request.cookies.get("session")?.value)
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
