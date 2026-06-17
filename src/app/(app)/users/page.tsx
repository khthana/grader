import { PageTitle } from "@/components/shell/ComingSoon"
import { UsersTable } from "@/components/users/UsersTable"
import { getCurrentUser } from "@/lib/session"

export default async function UsersPage() {
  const user = await getCurrentUser()
  // Impersonation is a dev-only testing aid; never offered in production.
  const allowImpersonation = process.env.NODE_ENV !== "production"

  return (
    <div className="flex flex-col gap-6">
      <PageTitle icon="users">จัดการผู้ใช้</PageTitle>
      <UsersTable currentUserId={user?.id} allowImpersonation={allowImpersonation} />
    </div>
  )
}
