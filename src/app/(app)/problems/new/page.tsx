import { redirect } from "next/navigation"
import { getCourseContext } from "@/lib/courses/server"
import { getCurrentUser } from "@/lib/session"
import { canManageCourses } from "@/lib/courses/access"
import { listWeeks } from "@/lib/weeks/repository"
import { getDb } from "@/lib/db"
import { ProblemEditor } from "@/components/problems/ProblemEditor"

interface PageProps {
  searchParams: Promise<{ courseId?: string; weekId?: string }>
}

export default async function NewProblemPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user || !canManageCourses(user.roles)) redirect("/problems")

  const { activeCourse } = await getCourseContext()
  if (!activeCourse) redirect("/problems")

  const { weekId: weekIdParam } = await searchParams
  const weekIdFromParam = weekIdParam ? Number.parseInt(weekIdParam, 10) : undefined

  const weeks = await listWeeks(getDb(), activeCourse.id)
  const initialWeekId = weeks.find((w) => w.id === weekIdFromParam)?.id ?? weeks[0]?.id

  return (
    <ProblemEditor
      courseId={activeCourse.id}
      weeks={weeks}
      mode="create"
      initialWeekId={initialWeekId}
    />
  )
}
