import { notFound } from "next/navigation"
import { parseCourseSlug, courseSlugString } from "@/lib/courses/slug"
import { getCourseAccess } from "@/lib/courses/server"
import { getDb } from "@/lib/db"
import { getSyllabus } from "@/lib/syllabus/repository"
import { listSyllabusStaff } from "@/lib/syllabus/staff"
import { SyllabusPanel } from "@/components/syllabus/SyllabusPanel"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string }>
}

// Everyone linked to the course reads the Syllabus; its managers edit it (#99).
export default async function CourseSyllabusPage({ params }: PageProps) {
  const { code, year, semester } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const access = await getCourseAccess(slug)
  if (!access) notFound()

  const db = getDb()
  const [syllabus, staff] = await Promise.all([getSyllabus(db, slug), listSyllabusStaff(db, slug)])
  const { course } = access

  return (
    <div className="font-thai">
      <SyllabusPanel
        courseSlug={courseSlugString(slug)}
        course={{ code: course.code, nameTh: course.nameTh, nameEn: course.nameEn }}
        staff={staff}
        initialSyllabus={syllabus}
        canEdit={access.manager}
      />
    </div>
  )
}
