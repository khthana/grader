import { notFound } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCurrentUser } from "@/lib/session"
import { canMutateRoster } from "@/lib/courses/access"
import { RosterTable } from "@/components/students/RosterTable"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string }>
}

export default async function CourseStudentsPage({ params }: PageProps) {
  const { code, year, semester } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const user = await getCurrentUser()
  if (!user) notFound()

  const coursePath = buildCoursePath(slug)
  const courseSlug = courseSlugString(slug)
  const canMutate = canMutateRoster(user.roles)

  return (
    <div className="font-thai">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">รายชื่อนักศึกษา</h1>
        <p className="mt-0.5 text-sm text-slate-500">{code} · {year}/{semester}</p>
      </div>
      <RosterTable courseSlug={courseSlug} coursePath={coursePath} canMutate={canMutate} />
    </div>
  )
}
