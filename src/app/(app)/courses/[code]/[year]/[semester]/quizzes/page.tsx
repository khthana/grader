import { notFound } from "next/navigation"
import { parseCourseSlug, buildCoursePath, courseSlugString } from "@/lib/courses/slug"
import { getCourseAccess } from "@/lib/courses/server"
import { QuizzesTable } from "@/components/quizzes/QuizzesTable"
import { StudentRoundCards } from "@/components/quizzes/StudentRoundCards"
import { getDb } from "@/lib/db"
import { listQuizzesForStudent } from "@/lib/quizzes/quiz-access"
import type { CourseKey } from "@/lib/courses/types"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string }>
}

// Staff manage every Quiz; a Student sees only those opened for their Group (#92).
export default async function CourseQuizzesPage({ params }: PageProps) {
  const { code, year, semester } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const access = await getCourseAccess(slug)
  if (!access) notFound()
  if (!access.staff) return <StudentQuizzes slug={slug} userId={access.user.id} />

  return (
    <div className="font-thai">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">แบบทดสอบ</h1>
        <p className="mt-0.5 text-sm text-slate-500">{code} · {year}/{semester}</p>
      </div>
      <QuizzesTable
        courseSlug={courseSlugString(slug)}
        coursePath={buildCoursePath(slug)}
        canManage={access.manager}
      />
    </div>
  )
}

async function StudentQuizzes({ slug, userId }: { slug: CourseKey; userId: number }) {
  const quizzes = await listQuizzesForStudent(getDb(), slug, userId, new Date())
  const coursePath = buildCoursePath(slug)
  return (
    <div className="font-thai">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">แบบทดสอบ</h1>
        <p className="mt-0.5 text-sm text-slate-500">Pre-test / Post-test · ไม่นับคะแนน</p>
      </div>
      {quizzes.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-slate-400">
          ยังไม่มีแบบทดสอบที่เปิดให้ทำ
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {quizzes.map((q) => (
            <div key={q.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3">
                <h2 className="font-medium text-slate-700">{q.title}</h2>
                <p className="text-xs text-slate-400">
                  {q.weekNo ? `สัปดาห์ที่ ${q.weekNo} · ` : ""}
                  {q.questionCount} ข้อ
                </p>
              </div>
              <StudentRoundCards rounds={q.rounds} quizPath={`${coursePath}/quizzes/${q.id}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
