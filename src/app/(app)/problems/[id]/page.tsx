import { notFound } from "next/navigation"
import Link from "next/link"
import { FaArrowLeft, FaClock } from "react-icons/fa"
import { CodeEditor } from "@/components/editor/CodeEditor"
import { getDb } from "@/lib/db"
import { getProblemById } from "@/lib/problems/repository"
import { getCourseContext } from "@/lib/courses/server"

interface PageProps {
  params: Promise<{ id: string }>
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

export default async function ProblemPage({ params }: PageProps) {
  const { id } = await params
  const problemId = Number.parseInt(id, 10)
  if (!Number.isFinite(problemId)) notFound()

  const { activeCourse } = await getCourseContext()
  const problem = await getProblemById(getDb(), problemId)

  if (!problem || (activeCourse && problem.courseId !== activeCourse.id)) {
    notFound()
  }

  const visibleCases = problem.testCases.filter((tc) => !tc.isHidden)
  const dueDate = formatDate(problem.dueAt)

  return (
    <div className="flex flex-col gap-6 font-thai">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">{problem.title}</h1>
        <Link
          href="/problems"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-secondary"
        >
          <FaArrowLeft className="h-3 w-3" /> โจทย์ทั้งหมด
        </Link>
      </div>

      {/* Due date */}
      {dueDate && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <FaClock className="h-3.5 w-3.5" />
          กำหนดส่ง: {dueDate}
        </div>
      )}

      {/* Problem description */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        {problem.description && (
          <p className="leading-relaxed text-slate-700 whitespace-pre-wrap">
            {problem.description}
          </p>
        )}

        {(problem.inputSpec || problem.outputSpec) && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {problem.inputSpec && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-slate-500">รูปแบบ Input</h2>
                <pre className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 whitespace-pre-wrap">
                  {problem.inputSpec}
                </pre>
              </div>
            )}
            {problem.outputSpec && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-slate-500">รูปแบบ Output</h2>
                <pre className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 whitespace-pre-wrap">
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
                  <p>Input: {tc.input || "(ไม่มี)"}</p>
                  <p>Output: {tc.expectedOutput}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Code editor */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-500">เขียน Code ของคุณ</h2>
        <CodeEditor problemId={problem.id} />
      </div>
    </div>
  )
}
