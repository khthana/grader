import { notFound } from "next/navigation"
import Link from "next/link"
import { FaArrowLeft } from "react-icons/fa"
import { getDb } from "@/lib/db"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getProblemByWeekAndNo } from "@/lib/problems/repository"
import { getWeekByNo } from "@/lib/weeks/repository"
import { getCurrentUser } from "@/lib/session"
import { canManageCourses } from "@/lib/courses/access"
import { SubmissionsTable } from "@/components/submissions/SubmissionsTable"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string; week: string; no: string }>
}

export default async function ProblemSubmissionsPage({ params }: PageProps) {
  const { code, year, semester, week, no } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const user = await getCurrentUser()
  if (!user || !canManageCourses(user.roles)) notFound()

  const weekNo = Number.parseInt(week, 10)
  const problemNo = Number.parseInt(no, 10)
  if (!Number.isFinite(weekNo) || !Number.isFinite(problemNo)) notFound()

  const db = getDb()
  const weekRecord = await getWeekByNo(db, slug, weekNo)
  if (!weekRecord) notFound()

  const problem = await getProblemByWeekAndNo(db, weekRecord.id, problemNo)
  if (!problem) notFound()

  const pointsMax =
    problem.problemType === "unit"
      ? problem.score
      : problem.testCases.reduce((sum, tc) => sum + (tc.score ?? 0), 0)
  const coursePath = buildCoursePath(slug)
  const courseSlug = courseSlugString(slug)

  return (
    <div className="flex flex-col gap-6 font-thai">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">ผลการส่งงาน</h1>
          <p className="mt-0.5 text-sm text-slate-500">{problem.title}</p>
        </div>
        <Link
          href={`${coursePath}/problems`}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-secondary"
        >
          <FaArrowLeft className="h-3 w-3" /> โจทย์ทั้งหมด
        </Link>
      </div>
      <SubmissionsTable
        courseSlug={courseSlug}
        problemId={problem.id}
        pointsMax={pointsMax}
      />
    </div>
  )
}
