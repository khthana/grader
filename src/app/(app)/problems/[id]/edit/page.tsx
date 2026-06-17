import { notFound, redirect } from "next/navigation"
import { getCourseContext } from "@/lib/courses/server"
import { getCurrentUser } from "@/lib/session"
import { canManageCourses } from "@/lib/courses/access"
import { listWeeks } from "@/lib/weeks/repository"
import { getProblemById } from "@/lib/problems/repository"
import { getDb } from "@/lib/db"
import { ProblemEditor } from "@/components/problems/ProblemEditor"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditProblemPage({ params }: PageProps) {
  const user = await getCurrentUser()
  if (!user || !canManageCourses(user.roles)) redirect("/problems")

  const { activeCourse } = await getCourseContext()
  if (!activeCourse) redirect("/problems")

  const { id } = await params
  const problemId = Number.parseInt(id, 10)
  if (!Number.isFinite(problemId)) notFound()

  const db = getDb()
  const problem = await getProblemById(db, problemId)
  if (!problem || problem.courseId !== activeCourse.id) notFound()

  const weeks = await listWeeks(db, activeCourse.id)

  return (
    <ProblemEditor
      courseId={activeCourse.id}
      weeks={weeks}
      mode="edit"
      problem={problem}
    />
  )
}
