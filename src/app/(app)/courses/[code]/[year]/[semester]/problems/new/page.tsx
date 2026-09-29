import { notFound, redirect } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCourseAccess } from "@/lib/courses/server"
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

  const access = await getCourseAccess(slug)
  if (!access?.manager) redirect(buildCoursePath(slug) + "/problems")
  const { course } = access

  const { weekId: weekIdParam } = await searchParams
  const weekIdFromParam = weekIdParam ? Number.parseInt(weekIdParam, 10) : undefined

  const db = getDb()
  const weeks = await listWeeks(db, slug)
  const initialWeekId = weeks.find((w) => w.id === weekIdFromParam)?.id ?? weeks[0]?.id

  return (
    <ProblemEditor
      courseSlug={courseSlugString(slug)}
      coursePath={buildCoursePath(slug)}
      courseLanguage={course.language}
      weeks={weeks}
      mode="create"
      initialWeekId={initialWeekId}
    />
  )
}
