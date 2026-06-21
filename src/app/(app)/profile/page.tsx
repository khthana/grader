import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { getDb } from "@/lib/db"
import { findUserByEmail } from "@/lib/users/repository"
import { ProfileForm } from "@/components/profile/ProfileForm"

export default async function ProfilePage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const db = getDb()
  const record = await findUserByEmail(db, user.email)
  const hasPassword = record?.passwordHash != null

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-thai text-2xl font-semibold text-slate-800">โปรไฟล์</h1>
      <ProfileForm
        email={user.email}
        name={user.name}
        nickname={user.nickname}
        picture={user.picture}
        activeRole={user.roles[0] ?? ""}
        hasPassword={hasPassword}
      />
    </div>
  )
}
