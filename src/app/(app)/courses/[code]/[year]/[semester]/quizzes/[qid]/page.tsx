import { notFound } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCourseAccess } from "@/lib/courses/server"
import { getDb } from "@/lib/db"
import { listWeeks } from "@/lib/weeks/repository"
import { getQuizForCourse } from "@/lib/quizzes/repository"
import { isQuizLocked } from "@/lib/quizzes/attempt-repository"
import { resolveStudentQuiz, studentRoundsWithAttempts } from "@/lib/quizzes/quiz-access"
import { QuizDetail } from "@/components/quizzes/QuizDetail"
import { StudentRoundCards } from "@/components/quizzes/StudentRoundCards"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string; qid: string }>
}

// Staff: the Quiz with its key, windows and editing. Students: their rounds —
// 404 (like an unknown id) until a round has opened for their Group (#92).
export default async function QuizPage({ params }: PageProps) {
  const { code, year, semester, qid } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const access = await getCourseAccess(slug)
  if (!access) notFound()
  const db = getDb()
  const coursePath = buildCoursePath(slug)

  if (!access.staff) {
    const visible = await resolveStudentQuiz(db, slug, access.user.id, qid, new Date())
    if (!visible) notFound()
    const { quiz } = visible
    const rounds = await studentRoundsWithAttempts(db, visible, access.user.id)
    return (
      <div className="font-thai">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-primary">{quiz.title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {quiz.questions.length} ข้อ · Pre-test และ Post-test เป็นข้อสอบชุดเดียวกัน · ไม่นับคะแนน
          </p>
        </div>
        {quiz.description && (
          <p className="mb-4 whitespace-pre-line rounded-xl border border-gray-200 bg-white p-5 text-sm text-slate-600">
            {quiz.description}
          </p>
        )}
        <StudentRoundCards
          rounds={rounds}
          quizPath={`${coursePath}/quizzes/${quiz.id}`}
        />
      </div>
    )
  }

  const id = Number(qid)
  const quiz = Number.isInteger(id) && id > 0 ? await getQuizForCourse(db, slug, id) : null
  if (!quiz) notFound()

  const [weeks, locked] = await Promise.all([listWeeks(db, slug), isQuizLocked(db, quiz.id)])

  return (
    <div className="font-thai">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">{quiz.title}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{code} · {year}/{semester} · แบบทดสอบ</p>
      </div>
      <QuizDetail
        initialQuiz={{ ...quiz, locked }}
        courseSlug={courseSlugString(slug)}
        coursePath={coursePath}
        weeks={weeks.map((w) => ({ id: w.id, weekNo: w.weekNo, topic: w.topic }))}
        canManage={access.manager}
      />
    </div>
  )
}
