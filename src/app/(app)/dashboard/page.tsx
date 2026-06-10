import { redirect } from "next/navigation"
import { getCurrentUser, getActiveRoleCookie } from "@/lib/session"
import { resolveActiveRole, getLandingRoute, type Role } from "@/lib/roles"

// Post-login landing resolver: send each user to their role's home page.
export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const requested = (await getActiveRoleCookie()) as Role | undefined
  const activeRole = resolveActiveRole(user.roles as Role[], requested)
  if (activeRole) redirect(getLandingRoute(activeRole))

  // No role assigned — the shell layout shows the "no access" state.
  return null
}
