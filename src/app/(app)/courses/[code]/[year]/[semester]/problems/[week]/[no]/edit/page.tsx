import { notFound, redirect } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCurrentUser } from "@/lib/session"
import { canManageCourses } from "@/lib/courses/access"
import { getDb } from "@/lib/db"
import { getProblemByWeekAndNo, getReferenceSolutionForStaff } from "@/lib/problems/repository"
import { getWeekByNo, listWeeks } from "@/lib/weeks/repository"
import { ProblemEditor } from "@/components/problems/ProblemEditor"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string; week: string; no: string }>
}

export default async function EditProblemPage({ params }: PageProps) {
  const { code, year, semester, week, no } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const user = await getCurrentUser()
  if (!user || !canManageCourses(user.roles)) redirect(buildCoursePath(slug) + "/problems")

  const weekNo = Number.parseInt(week, 10)
  const problemNo = Number.parseInt(no, 10)
  if (!Number.isFinite(weekNo) || !Number.isFinite(problemNo)) notFound()

  const db = getDb()
  const [weekRecord, weeks] = await Promise.all([
    getWeekByNo(db, slug, weekNo),
    listWeeks(db, slug),
  ])
  if (!weekRecord) notFound()

  const problem = await getProblemByWeekAndNo(db, weekRecord.id, problemNo)
  if (!problem) notFound()

  // Gate rides the read: only course managers receive the value (the page also
  // redirected non-managers above, so this resolves to ok in practice).
  const refResult = await getReferenceSolutionForStaff(db, problem.id, user.roles)
  const referenceSolution = refResult.ok ? refResult.solution : ""

  const coursePath = buildCoursePath(slug)
  const courseSlug = courseSlugString(slug)

  return (
    <ProblemEditor
      courseSlug={courseSlug}
      coursePath={coursePath}
      weeks={weeks}
      mode="edit"
      problem={problem}
      referenceSolution={referenceSolution}
    />
  )
}
