import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { getCurrentUser, getActiveRoleCookie, isImpersonating } from "@/lib/session"
import { resolveActiveRole, type Role } from "@/lib/roles"
import { getCourseContext } from "@/lib/courses/server"
import { AppShell } from "@/components/shell/AppShell"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const roles = user.roles as Role[]
  const requested = (await getActiveRoleCookie()) as Role | undefined
  const activeRole = resolveActiveRole(roles, requested)

  if (!activeRole) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-[#F8FAFC] font-thai">
        <h1 className="text-xl font-semibold text-primary">ยังไม่ได้รับสิทธิ์การใช้งาน</h1>
        <p className="text-slate-500">บัญชีของคุณยังไม่ได้รับการกำหนดบทบาท กรุณาติดต่อผู้ดูแลระบบ</p>
      </main>
    )
  }

  const { courses, activeCourse } = await getCourseContext()
  const impersonating = await isImpersonating()

  return (
    <AppShell
      name={user.name}
      picture={user.picture}
      roles={roles}
      activeRole={activeRole}
      courses={courses}
      activeCourseId={activeCourse?.id ?? null}
      impersonatedName={impersonating ? user.name : null}
    >
      {children}
    </AppShell>
  )
}
