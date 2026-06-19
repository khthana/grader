import { notFound } from "next/navigation"
import { Suspense } from "react"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCurrentUser } from "@/lib/session"
import { getDb } from "@/lib/db"
import { getCourseByKey } from "@/lib/courses/repository"
import { AssignmentsList } from "@/components/assignments/AssignmentsList"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string }>
  searchParams: Promise<{ week?: string }>
}

export default async function CourseAssignmentsPage({ params, searchParams }: PageProps) {
  const { code, year, semester } = await params
  const { week } = await searchParams

  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const user = await getCurrentUser()
  if (!user) notFound()

  const course = await getCourseByKey(getDb(), slug)
  if (!course) notFound()

  const courseSlug = courseSlugString(slug)
  const coursePath = buildCoursePath(slug)
  const initialWeek = week ? parseInt(week, 10) : 1

  return (
    <div className="flex flex-col gap-6 font-thai">
      <div>
        <h1 className="text-2xl font-semibold text-primary">งานที่ได้รับมอบหมาย</h1>
        <p className="mt-0.5 text-sm text-slate-500">{course.code} · {course.nameTh}</p>
      </div>
      <Suspense>
        <AssignmentsList
          courseSlug={courseSlug}
          coursePath={coursePath}
          initialWeek={initialWeek}
        />
      </Suspense>
    </div>
  )
}
