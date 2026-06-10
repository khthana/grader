import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { getUserById, setUserRoles, countUsersWithRole } from "@/lib/users/repository"
import { isRole } from "@/lib/roles"

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAdmin(request)
  if (!guard.ok) return guard.response

  const { id: rawId } = await context.params
  const id = Number.parseInt(rawId, 10)
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as { roles?: unknown }
  const roles = Array.isArray(body.roles) ? body.roles.map(String) : []
  if (roles.some((r) => !isRole(r))) {
    return NextResponse.json({ errors: { roles: "มีบทบาทที่ไม่ถูกต้อง" } }, { status: 400 })
  }

  const db = getDb()
  const user = await getUserById(db, id)
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Guard against locking everyone out: don't remove the system's last Admin.
  const losingAdmin = user.roles.includes("Admin") && !roles.includes("Admin")
  if (losingAdmin && (await countUsersWithRole(db, "Admin")) <= 1) {
    return NextResponse.json(
      { errors: { roles: "ไม่สามารถถอดบทบาท Admin คนสุดท้ายของระบบได้" } },
      { status: 409 }
    )
  }

  await setUserRoles(db, id, roles)
  const updated = await getUserById(db, id)
  return NextResponse.json(updated)
}
