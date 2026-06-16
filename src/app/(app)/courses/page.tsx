import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { canManageCourses } from "@/lib/courses/access"
import { CoursesTable } from "@/components/courses/CoursesTable"

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>
}) {
  const user = await getCurrentUser()
  if (!user || !canManageCourses(user.roles)) redirect("/dashboard")

  const { new: openCreate } = await searchParams
  return <CoursesTable openCreate={openCreate === "1"} />
}
