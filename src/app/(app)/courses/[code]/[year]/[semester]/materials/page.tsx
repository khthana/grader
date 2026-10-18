import { notFound } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCourseAccess } from "@/lib/courses/server"
import { getDb } from "@/lib/db"
import { loadMaterialsOutline } from "@/lib/materials/access"
import { MaterialsOutline } from "@/components/materials/MaterialsOutline"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string }>
}

// Teaching Materials by Teaching Plan week (#109), as one table (#120) — everyone linked reads what
// the Student View lets them; the course's managers write.
export default async function CourseMaterialsPage({ params }: PageProps) {
  const { code, year, semester } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const access = await getCourseAccess(slug)
  if (!access) notFound()

  const { outline, hasPlan } = await loadMaterialsOutline(getDb(), slug, access)

  return (
    <div className="flex flex-col gap-4 font-thai">
      <div>
        <h1 className="text-2xl font-semibold text-primary">เอกสารการสอน</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {access.course.code} · {access.course.nameTh}
        </p>
      </div>
      <MaterialsOutline
        outline={outline}
        courseSlug={courseSlugString(slug)}
        coursePath={buildCoursePath(slug)}
        canEdit={access.manager}
        staff={access.staff}
        hasPlan={hasPlan}
      />
    </div>
  )
}
