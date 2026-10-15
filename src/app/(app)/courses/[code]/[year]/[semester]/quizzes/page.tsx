import { notFound } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCourseAccess } from "@/lib/courses/server"
import { QuizzesTable } from "@/components/quizzes/QuizzesTable"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string }>
}

// Staff-only until students get their own quiz list (#92).
export default async function CourseQuizzesPage({ params }: PageProps) {
  const { code, year, semester } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const access = await getCourseAccess(slug)
  if (!access?.staff) notFound()

  return (
    <div className="font-thai">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">แบบทดสอบ</h1>
        <p className="mt-0.5 text-sm text-slate-500">{code} · {year}/{semester}</p>
      </div>
      <QuizzesTable
        courseSlug={courseSlugString(slug)}
        coursePath={buildCoursePath(slug)}
        canManage={access.manager}
      />
    </div>
  )
}
