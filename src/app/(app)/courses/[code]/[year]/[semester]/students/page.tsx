import { notFound } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCourseAccess } from "@/lib/courses/server"
import { RosterTable } from "@/components/students/RosterTable"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string }>
}

export default async function CourseStudentsPage({ params }: PageProps) {
  const { code, year, semester } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  // Roster is teaching staff of this course only — a Student has no access
  // (ADR 0001, #70), nor does staff of another course (#73).
  const access = await getCourseAccess(slug)
  if (!access?.staff) notFound()

  const coursePath = buildCoursePath(slug)
  const courseSlug = courseSlugString(slug)
  // Roster mutators (Admin/Instructor) are exactly this course's managers.
  const canMutate = access.manager

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
