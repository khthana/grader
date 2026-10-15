import { notFound } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCourseAccess } from "@/lib/courses/server"
import { getDb } from "@/lib/db"
import { listWeeks } from "@/lib/weeks/repository"
import { getQuizForCourse } from "@/lib/quizzes/repository"
import { QuizDetail } from "@/components/quizzes/QuizDetail"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string; qid: string }>
}

// Staff view with the answer key — students get their own page (#92).
export default async function QuizPage({ params }: PageProps) {
  const { code, year, semester, qid } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const access = await getCourseAccess(slug)
  if (!access?.staff) notFound()

  const id = Number(qid)
  const db = getDb()
  const quiz = Number.isInteger(id) && id > 0 ? await getQuizForCourse(db, slug, id) : null
  if (!quiz) notFound()

  const weeks = await listWeeks(db, slug)

  return (
    <div className="font-thai">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">{quiz.title}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{code} · {year}/{semester} · แบบทดสอบ</p>
      </div>
      <QuizDetail
        initialQuiz={quiz}
        courseSlug={courseSlugString(slug)}
        coursePath={buildCoursePath(slug)}
        weeks={weeks.map((w) => ({ id: w.id, weekNo: w.weekNo, topic: w.topic }))}
        canManage={access.manager}
      />
    </div>
  )
}
