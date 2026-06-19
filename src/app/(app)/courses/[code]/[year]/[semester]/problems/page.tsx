import { notFound } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCurrentUser } from "@/lib/session"
import { canManageCourses } from "@/lib/courses/access"
import { ProblemsTable } from "@/components/problems/ProblemsTable"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string }>
}

export default async function CourseProblemsPage({ params }: PageProps) {
  const { code, year, semester } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const user = await getCurrentUser()
  if (!user) notFound()

  const coursePath = buildCoursePath(slug)
  const courseSlug = courseSlugString(slug)
  const canManage = canManageCourses(user.roles)

  return (
    <div className="font-thai">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">โจทย์ปัญหา</h1>
        <p className="mt-0.5 text-sm text-slate-500">{code} · {year}/{semester}</p>
      </div>
      <ProblemsTable courseSlug={courseSlug} coursePath={coursePath} canManage={canManage} />
    </div>
  )
}
