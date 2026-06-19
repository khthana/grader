import { notFound } from "next/navigation"
import { parseCourseSlug } from "@/lib/courses/slug"
import { getCourseByKey } from "@/lib/courses/repository"
import { getDb } from "@/lib/db"

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
  const course = await getCourseByKey(getDb(), slug)
  if (!course) notFound()
  return <>{children}</>
}
