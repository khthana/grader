import { notFound } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCourseAccess } from "@/lib/courses/server"
import { getDb } from "@/lib/db"
import { resolveStudentQuiz } from "@/lib/quizzes/quiz-access"
import { findQuizForCourse } from "@/lib/quizzes/route-helpers"
import { quizForStudent } from "@/lib/quizzes/result-view"
import { isQuizRound } from "@/lib/quizzes/round-window"
import { QuizTaker } from "@/components/quizzes/QuizTaker"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string; qid: string; round: string }>
}

// A Student takes one Quiz Round here; staff get a preview of the same page
// (the Student's view, no key) that never creates an attempt (#92).
export default async function QuizRoundPage({ params }: PageProps) {
  const { code, year, semester, qid, round } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug || !isQuizRound(round)) notFound()

  const access = await getCourseAccess(slug)
  if (!access) notFound()
  const db = getDb()

  const quiz = access.staff
    ? await findQuizForCourse(db, slug, qid)
    : (await resolveStudentQuiz(db, slug, access.user.id, qid, new Date()))?.quiz
  if (!quiz) notFound()

  const coursePath = buildCoursePath(slug)
  return (
    <div className="font-thai">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">{quiz.title}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{quiz.questions.length} ข้อ · ไม่นับคะแนน</p>
      </div>
      <QuizTaker
        courseSlug={courseSlugString(slug)}
        quizPath={`${coursePath}/quizzes/${quiz.id}`}
        quizId={quiz.id}
        round={round}
        preview={access.staff ? quizForStudent(quiz) : undefined}
      />
    </div>
  )
}
