import { notFound } from "next/navigation"
import { parseCourseSlug, courseSlugString } from "@/lib/courses/slug"
import { getCurrentUser } from "@/lib/session"
import { isTeachingStaff } from "@/lib/courses/access"
import { GradebookTable } from "@/components/gradebook/GradebookTable"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string }>
}

export default async function CourseGradebookPage({ params }: PageProps) {
  const { code, year, semester } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const user = await getCurrentUser()
  if (!user || !isTeachingStaff(user.roles)) notFound()

  const courseSlug = courseSlugString(slug)

  return (
    <div className="flex flex-col gap-6 font-thai">
      <div>
        <h1 className="text-2xl font-semibold text-primary">สมุดคะแนน</h1>
        <p className="mt-0.5 text-sm text-slate-500">{code} · {year}/{semester}</p>
      </div>
      <GradebookTable courseSlug={courseSlug} />
    </div>
  )
}
