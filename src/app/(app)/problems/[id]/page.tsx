import Link from "next/link"
import { FaArrowLeft } from "react-icons/fa"
import { CodeEditor } from "@/components/editor/CodeEditor"
import { PageTitle } from "@/components/shell/ComingSoon"

// ข้อมูลโจทย์ตัวอย่าง — ย้ายไป database ทีหลังได้
const problems = {
  "hello-world": {
    id: "hello-world",
    title: "Hello, World!",
    description: `จงเขียนโปรแกรม Python ที่แสดงผลข้อความ Hello, World! ออกทางหน้าจอ`,
    examples: [{ input: "ไม่มี input", output: "Hello, World!" }],
  },
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProblemPage({ params }: PageProps) {
  const { id } = await params
  const problem = problems[id as keyof typeof problems]

  if (!problem) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 font-thai">
        <p className="text-slate-400">ไม่พบโจทย์นี้</p>
        <Link href="/problems" className="text-sm text-secondary hover:underline">
          กลับไปหน้าโจทย์ปัญหา
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 font-thai">
      <div className="flex items-center justify-between">
        <PageTitle icon="problems">{problem.title}</PageTitle>
        <Link
          href="/problems"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-secondary"
        >
          <FaArrowLeft className="h-3 w-3" /> โจทย์ทั้งหมด
        </Link>
      </div>

      {/* Problem description */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="leading-relaxed text-slate-700">{problem.description}</p>
        <div className="mt-4 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-500">ตัวอย่าง</h2>
          {problem.examples.map((ex, i) => (
            <div key={i} className="rounded-lg bg-slate-50 p-4 font-mono text-sm text-slate-600">
              <p>Input: {ex.input}</p>
              <p>Output: {ex.output}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Code editor */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-500">เขียน Code ของคุณ</h2>
        <CodeEditor problemId={problem.id} />
      </div>
    </div>
  )
}
