import { notFound } from "next/navigation"
import { Suspense } from "react"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCurrentUser } from "@/lib/session"
import { getDb } from "@/lib/db"
import { getCourseByKey } from "@/lib/courses/repository"
import { getUserById } from "@/lib/users/repository"
import { ScoreList } from "@/components/scorebook/ScoreList"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string }>
  searchParams: Promise<{ week?: string }>
}

export default async function CourseScorebookPage({ params, searchParams }: PageProps) {
  const { code, year, semester } = await params
  const { week } = await searchParams

  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const sessionUser = await getCurrentUser()
  if (!sessionUser) notFound()

  const db = getDb()
  const [course, userDetail] = await Promise.all([
    getCourseByKey(db, slug),
    getUserById(db, sessionUser.id),
  ])
  if (!course) notFound()

  const courseSlug = courseSlugString(slug)
  const coursePath = buildCoursePath(slug)
  const initialWeek = week ? parseInt(week, 10) : 1

  const displayName = userDetail
    ? [userDetail.firstNameTh, userDetail.lastNameTh].filter(Boolean).join(" ") || userDetail.name
    : sessionUser.name
  const subtitle = userDetail?.idCode ? `${userDetail.idCode} · ${displayName}` : displayName

  return (
    <div className="flex flex-col gap-6 font-thai">
      <div>
        <h1 className="text-2xl font-semibold text-primary">สมุดคะแนนของฉัน</h1>
        <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
      </div>
      <Suspense>
        <ScoreList
          courseSlug={courseSlug}
          coursePath={coursePath}
          initialWeek={initialWeek}
        />
      </Suspense>
    </div>
  )
}
