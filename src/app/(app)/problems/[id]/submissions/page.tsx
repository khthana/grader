import { notFound } from "next/navigation"
import Link from "next/link"
import { FaArrowLeft } from "react-icons/fa"
import { getDb } from "@/lib/db"
import { getProblemById } from "@/lib/problems/repository"
import { getCourseContext } from "@/lib/courses/server"
import { getCurrentUser } from "@/lib/session"
import { canManageCourses } from "@/lib/courses/access"
import { SubmissionsTable } from "@/components/submissions/SubmissionsTable"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SubmissionsPage({ params }: PageProps) {
  const { id } = await params
  const problemId = Number.parseInt(id, 10)
  if (!Number.isFinite(problemId)) notFound()

  const user = await getCurrentUser()
  if (!user) notFound()
  if (!canManageCourses(user.roles)) notFound()

  const { activeCourse } = await getCourseContext()
  const problem = await getProblemById(getDb(), problemId)

  if (!problem || (activeCourse && problem.courseId !== activeCourse.id)) {
    notFound()
  }

  const pointsMax = problem.testCases.reduce((sum, tc) => sum + (tc.score ?? 0), 0)

  return (
    <div className="flex flex-col gap-6 font-thai">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">ผลการส่งงาน</h1>
          <p className="mt-0.5 text-sm text-slate-500">{problem.title}</p>
        </div>
        <Link
          href="/problems"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-secondary"
        >
          <FaArrowLeft className="h-3 w-3" /> โจทย์ทั้งหมด
        </Link>
      </div>

      <SubmissionsTable
        courseId={problem.courseId}
        problemId={problem.id}
        pointsMax={pointsMax}
      />
    </div>
  )
}
