import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { getUserById } from "@/lib/users/repository"
import { createSessionToken, SESSION_COOKIE_OPTIONS } from "@/lib/auth"
import { canImpersonate } from "@/lib/users/impersonation"
import { safeLog } from "@/lib/logs"

type RouteContext = { params: Promise<{ id: string }> }

// Begin impersonating a user (dev-only). Saves the Admin's current session into
// an `impersonator` cookie and swaps `session` to a token for the target user,
// so the whole shell reflects that user. Clears active_role / active_course so
// the impersonated user resolves to their own defaults.
export async function POST(request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin(request)
  if (!guard.ok) return guard.response

  const { id: rawId } = await context.params
  const id = Number.parseInt(rawId, 10)
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const check = canImpersonate({
    actorRoles: guard.user.roles,
    actorId: guard.user.id,
    targetId: id,
    isProduction: process.env.NODE_ENV === "production",
  })
  if (!check.ok) {
    // In production the feature does not exist; self is a bad request.
    const status = check.reason === "production" ? 404 : 400
    return NextResponse.json({ error: check.reason }, { status })
  }

  const db = getDb()
  const target = await getUserById(db, id)
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })
  // A deactivated account can't hold a session (#75) — swapping into one would
  // strand the Admin on the login page with their token parked in `impersonator`.
  if (!target.isActive) return NextResponse.json({ error: "inactive" }, { status: 409 })

  const adminToken = request.cookies.get("session")?.value
  const targetToken = createSessionToken({
    email: target.email,
    name: target.name,
    picture: target.picture ?? undefined,
  })

  const response = NextResponse.json({ ok: true })
  if (adminToken) response.cookies.set("impersonator", adminToken, SESSION_COOKIE_OPTIONS)
  response.cookies.set("session", targetToken, SESSION_COOKIE_OPTIONS)
  response.cookies.delete("active_role")
  response.cookies.delete("active_course")

  await safeLog(db, {
    actorId: guard.user.id,
    actorEmail: guard.user.email,
    action: "user.impersonate",
    targetId: target.id,
    targetEmail: target.email,
  })

  return response
}
