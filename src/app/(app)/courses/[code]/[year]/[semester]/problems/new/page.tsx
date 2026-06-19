import { notFound, redirect } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCurrentUser } from "@/lib/session"
import { canManageCourses } from "@/lib/courses/access"
import { listWeeks } from "@/lib/weeks/repository"
import { getDb } from "@/lib/db"
import { ProblemEditor } from "@/components/problems/ProblemEditor"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string }>
  searchParams: Promise<{ weekId?: string }>
}

export default async function NewProblemPage({ params, searchParams }: PageProps) {
  const { code, year, semester } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const user = await getCurrentUser()
  if (!user || !canManageCourses(user.roles)) redirect(buildCoursePath(slug) + "/problems")

  const { weekId: weekIdParam } = await searchParams
  const weekIdFromParam = weekIdParam ? Number.parseInt(weekIdParam, 10) : undefined

  const weeks = await listWeeks(getDb(), slug)
  const initialWeekId = weeks.find((w) => w.id === weekIdFromParam)?.id ?? weeks[0]?.id

  return (
    <ProblemEditor
      courseSlug={courseSlugString(slug)}
      coursePath={buildCoursePath(slug)}
      weeks={weeks}
      mode="create"
      initialWeekId={initialWeekId}
    />
  )
}
