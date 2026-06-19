import { notFound } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCurrentUser } from "@/lib/session"
import { AssignmentsList } from "@/components/assignments/AssignmentsList"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string }>
}

export default async function CourseAssignmentsPage({ params }: PageProps) {
  const { code, year, semester } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const user = await getCurrentUser()
  if (!user) notFound()

  const courseSlug = courseSlugString(slug)
  const coursePath = buildCoursePath(slug)

  return (
    <div className="flex flex-col gap-6 font-thai">
      <div>
        <h1 className="text-2xl font-semibold text-primary">งานที่ได้รับมอบหมาย</h1>
        <p className="mt-0.5 text-sm text-slate-500">{code} · {year}/{semester}</p>
      </div>
      <AssignmentsList courseSlug={courseSlug} coursePath={coursePath} />
    </div>
  )
}
