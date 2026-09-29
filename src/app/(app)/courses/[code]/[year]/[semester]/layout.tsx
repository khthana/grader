import { notFound } from "next/navigation"
import { parseCourseSlug } from "@/lib/courses/slug"
import { getCourseAccess } from "@/lib/courses/server"

export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ code: string; year: string; semester: string }>
}) {
  const { code, year, semester } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()
  // Entitlement, not just existence (#73): a user with no link to this course
  // (not on its staff, not enrolled, not Admin) gets a 404 for every page in it.
  if (!(await getCourseAccess(slug))) notFound()
  return <>{children}</>
}
