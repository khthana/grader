import { PageTitle } from "@/components/shell/ComingSoon"
import { UsersTable } from "@/components/users/UsersTable"

// User Management (read). Create/edit/delete + roles + import arrive in #4-#7.
export default function UsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageTitle icon="users">จัดการผู้ใช้</PageTitle>
      <UsersTable />
    </div>
  )
}
