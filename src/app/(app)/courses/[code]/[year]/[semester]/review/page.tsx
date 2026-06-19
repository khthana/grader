import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { parseCourseSlug, courseSlugString, buildCoursePath } from "@/lib/courses/slug"
import { getCurrentUser } from "@/lib/session"
import { canManageCourses } from "@/lib/courses/access"
import { getDb } from "@/lib/db"
import { listProblems } from "@/lib/problems/repository"
import { getProblemIdsWithSubmissions } from "@/lib/submissions/repository"
import { ReviewWorkbench } from "@/components/review/ReviewWorkbench"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string }>
  searchParams: Promise<{ pid?: string; sid?: string }>
}

export default async function CourseReviewPage({ params, searchParams }: PageProps) {
  const { code, year, semester } = await params
  const { pid } = await searchParams

  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const user = await getCurrentUser()
  if (!user || !canManageCourses(user.roles)) notFound()

  const db = getDb()
  const [problems, problemIdsWithSubs] = await Promise.all([
    listProblems(db, slug),
    getProblemIdsWithSubmissions(db, slug),
  ])

  if (!pid) {
    const first = problems.find((p) => problemIdsWithSubs.includes(p.id)) ?? problems[0]
    if (first) redirect(`${buildCoursePath(slug)}/review?pid=${first.id}`)
  }

  const courseSlug = courseSlugString(slug)

  return (
    <Suspense>
      <ReviewWorkbench problems={problems} courseSlug={courseSlug} />
    </Suspense>
  )
}
