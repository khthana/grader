import { notFound } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCourseAccess } from "@/lib/courses/server"
import { getDb } from "@/lib/db"
import { loadMaterial } from "@/lib/materials/access"
import { parseMaterialAddress } from "@/lib/materials/params"
import { MaterialPanel } from "@/components/materials/MaterialPanel"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string; week: string; kind: string }>
}

// One Teaching Material (#109). A viewer the Student View refuses gets the same
// 404 as for one that doesn't exist; a manager opening an empty slot writes it.
export default async function CourseMaterialPage({ params }: PageProps) {
  const { code, year, semester, week, kind } = await params
  const slug = parseCourseSlug(code, year, semester)
  const address = parseMaterialAddress(week, kind)
  if (!slug || !address) notFound()

  const access = await getCourseAccess(slug)
  if (!access) notFound()

  const { exists, material, heading } = await loadMaterial(getDb(), slug, address, access)
  if (exists ? !material : !access.manager) notFound()

  return (
    <div className="font-thai">
      <MaterialPanel
        courseSlug={courseSlugString(slug)}
        coursePath={buildCoursePath(slug)}
        weekNo={address.weekNo}
        kind={address.kind}
        heading={heading}
        initialMaterial={material}
        canEdit={access.manager}
        staff={access.staff}
      />
    </div>
  )
}
