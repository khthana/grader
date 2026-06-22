import { notFound } from "next/navigation"
import Link from "next/link"
import { FaArrowLeft, FaClock, FaExclamationTriangle, FaLock } from "react-icons/fa"
import { CodeEditor } from "@/components/editor/CodeEditor"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import { getDb } from "@/lib/db"
import { parseCourseSlug, buildCoursePath } from "@/lib/courses/slug"
import { getProblemByWeekAndNo } from "@/lib/problems/repository"
import { getWeekByNo } from "@/lib/weeks/repository"
import { getCurrentUser } from "@/lib/session"
import { getLastSubmission } from "@/lib/submissions/repository"

interface PageProps {
  params: Promise<{ code: string; year: string; semester: string; week: string; no: string }>
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function CourseProblemPage({ params }: PageProps) {
  const { code, year, semester, week, no } = await params
  const slug = parseCourseSlug(code, year, semester)
  if (!slug) notFound()

  const weekNo = Number.parseInt(week, 10)
  const problemNo = Number.parseInt(no, 10)
  if (!Number.isFinite(weekNo) || !Number.isFinite(problemNo)) notFound()

  const db = getDb()
  const weekRecord = await getWeekByNo(db, slug, weekNo)
  if (!weekRecord) notFound()

  const user = await getCurrentUser()
  const isPrivileged = user?.roles.some((r) => ["Admin", "Instructor", "TA"].includes(r))

  if (!isPrivileged && !weekRecord.isReleased) {
    const coursePath = buildCoursePath(slug)
    return (
      <div className="flex flex-col gap-6 font-thai">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-primary">สัปดาห์ที่ {weekRecord.weekNo}</h1>
          <Link
            href={`${coursePath}/problems`}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-secondary"
          >
            <FaArrowLeft className="h-3 w-3" /> โจทย์ทั้งหมด
          </Link>
        </div>
        <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
          <FaLock className="h-8 w-8 text-slate-300" />
          <p className="text-lg font-semibold text-slate-500">ยังไม่เปิดรับ</p>
          <p className="text-sm text-slate-400">สัปดาห์นี้ยังไม่ถูกปล่อยโดยอาจารย์ผู้สอน</p>
        </div>
      </div>
    )
  }

  const problem = await getProblemByWeekAndNo(db, weekRecord.id, problemNo)
  if (!problem) notFound()
  const lastSubmission =
    user && !isPrivileged ? await getLastSubmission(db, problem.id, user.id) : null

  const visibleCases = problem.testCases.filter((tc) => !tc.isHidden)
  const dueDate = formatDate(problem.dueAt)
  const now = new Date()
  const isClosed = problem.closeAt ? new Date(problem.closeAt) < now : false
  const isLateWindow = !isClosed && problem.dueAt ? new Date(problem.dueAt) < now : false
  const pointsMax =
    problem.problemType === "unit"
      ? problem.score
      : problem.testCases.reduce((s, tc) => s + (tc.score ?? 0), 0)
  const effectiveScore = lastSubmission?.manualScore ?? lastSubmission?.pointsEarned ?? null
  const coursePath = buildCoursePath(slug)

  return (
    <div className="flex flex-col gap-6 font-thai">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">{problem.title}</h1>
        <Link
          href={`${coursePath}/problems`}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-secondary"
        >
          <FaArrowLeft className="h-3 w-3" /> โจทย์ทั้งหมด
        </Link>
      </div>

      {effectiveScore != null && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
          effectiveScore === pointsMax
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-blue-200 bg-blue-50 text-blue-700"
        }`}>
          คะแนนล่าสุดของคุณ: {effectiveScore}/{pointsMax} คะแนน
          {lastSubmission?.isLate && (
            <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
              ส่งช้า
            </span>
          )}
        </div>
      )}

      {dueDate && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <FaClock className="h-3.5 w-3.5" />
          กำหนดส่ง: {dueDate}
        </div>
      )}
      {isClosed && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <FaExclamationTriangle className="h-4 w-4 shrink-0" />
          หมดเวลาส่งงานแล้ว — ไม่สามารถส่งคำตอบได้อีก
        </div>
      )}
      {isLateWindow && (
        <div className="flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-700">
          <FaExclamationTriangle className="h-4 w-4 shrink-0" />
          ⚠ ส่งช้า — เลยกำหนดส่งแล้ว แต่ยังส่งได้อยู่ งานจะถูกบันทึกว่าส่งช้า
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        {problem.description && (
          <MarkdownContent content={problem.description} />
        )}
        {(problem.inputSpec || problem.outputSpec) && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {problem.inputSpec && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-slate-500">รูปแบบ Input</h2>
                <pre className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 whitespace-pre-wrap break-words">
                  {problem.inputSpec}
                </pre>
              </div>
            )}
            {problem.outputSpec && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-slate-500">รูปแบบ Output</h2>
                <pre className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 whitespace-pre-wrap break-words">
                  {problem.outputSpec}
                </pre>
              </div>
            )}
          </div>
        )}
        {visibleCases.length > 0 && (
          <div className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-500">ตัวอย่าง</h2>
            <div className="flex flex-col gap-2">
              {visibleCases.map((tc, i) => (
                <div key={tc.id} className="rounded-lg bg-slate-50 p-4 font-mono text-sm text-slate-600">
                  <p className="mb-1 text-xs font-semibold text-slate-400">ตัวอย่าง {i + 1}</p>
                  <p className="break-words">Input: {tc.input || "(ไม่มี)"}</p>
                  <p className="break-words">Output: {tc.expectedOutput}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-500">เขียน Code ของคุณ</h2>
        <CodeEditor
          problemId={problem.id}
          draftKey={`editor-code-${code}/${year}/${semester}/${weekNo}/${problemNo}`}
          isClosed={isClosed}
          starterCode={problem.starterCode || ""}
          problemType={problem.problemType}
        />
      </div>
    </div>
  )
}
