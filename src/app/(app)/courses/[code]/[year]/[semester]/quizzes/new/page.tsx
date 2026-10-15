import { notFound } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCourseAccess } from "@/lib/courses/server"
import { getDb } from "@/lib/db"
import { listWeeks } from "@/lib/weeks/repository"
import { QuizImportForm } from "@/components/quizzes/QuizImportForm"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string }>
}

export default async function NewQuizPage({ params }: PageProps) {
  const { code, year, semester } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const access = await getCourseAccess(slug)
  if (!access?.manager) notFound()

  const weeks = await listWeeks(getDb(), slug)

  return (
    <div className="font-thai">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">นำเข้าแบบทดสอบ</h1>
        <p className="mt-0.5 text-sm text-slate-500">{code} · {year}/{semester}</p>
      </div>
      <QuizImportForm
        courseSlug={courseSlugString(slug)}
        coursePath={buildCoursePath(slug)}
        weeks={weeks.map((w) => ({ id: w.id, weekNo: w.weekNo, topic: w.topic }))}
        mode="create"
      />
    </div>
  )
}
