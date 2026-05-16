import { CodeEditor } from "@/components/editor/CodeEditor"

// ข้อมูลโจทย์ตัวอย่าง — ย้ายไป database ทีหลังได้
const problems = {
  "hello-world": {
    id: "hello-world",
    title: "Hello, World!",
    description: `จงเขียนโปรแกรม Python ที่แสดงผลข้อความ Hello, World! ออกทางหน้าจอ`,
    examples: [
      {
        input: "ไม่มี input",
        output: "Hello, World!",
      },
    ],
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">ไม่พบโจทย์นี้</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* Problem Description */}
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">{problem.title}</h1>
          <p className="text-gray-300 leading-relaxed">{problem.description}</p>

          {/* Examples */}
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">ตัวอย่าง</h2>
            {problem.examples.map((ex, i) => (
              <div
                key={i}
                className="p-4 bg-gray-900 rounded-lg border border-gray-800 
                           text-sm font-mono flex flex-col gap-1"
              >
                <p className="text-gray-400">Input: {ex.input}</p>
                <p className="text-gray-400">Output: {ex.output}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Code Editor */}
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">เขียน Code ของคุณ</h2>
          <CodeEditor problemId={problem.id} />
        </div>

      </div>
    </div>
  )
}
