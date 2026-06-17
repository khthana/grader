"use client"

import { useEffect, useState } from "react"

interface GradebookProblem {
  id: number
  title: string
  weekNo: number
  pointsMax: number
}

interface GradebookStudent {
  userId: number
  name: string
  idCode: string | null
  scores: Record<number, number | null>
}

interface Gradebook {
  problems: GradebookProblem[]
  students: GradebookStudent[]
}

function scoreCell(score: number | null, pointsMax: number) {
  if (score === null)
    return <span className="text-slate-300">–</span>
  if (score === pointsMax)
    return <span className="font-semibold text-green-600">{score}</span>
  if (score > 0)
    return <span className="text-yellow-600">{score}</span>
  return <span className="text-red-500">{score}</span>
}

export function GradebookTable({ courseId }: { courseId: number }) {
  const [gradebook, setGradebook] = useState<Gradebook | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/courses/${courseId}/gradebook`)
      .then((r) => r.json())
      .then(({ gradebook: gb }) => setGradebook(gb))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [courseId])

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-400 font-thai">กำลังโหลด...</div>
  }

  if (!gradebook || gradebook.students.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-slate-400 font-thai">
        ยังไม่มีนักศึกษาในรายวิชานี้
      </div>
    )
  }

  const { problems, students } = gradebook

  // Group problems by week
  const weekNos = [...new Set(problems.map((p) => p.weekNo))].sort((a, b) => a - b)

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white font-thai">
      <table className="min-w-full text-sm">
        <thead>
          {/* Week header row */}
          <tr className="bg-slate-100 text-xs font-semibold text-slate-500">
            <th className="sticky left-0 z-10 bg-slate-100 px-5 py-2 text-left" rowSpan={2}>
              รหัส / ชื่อ
            </th>
            {weekNos.map((wn) => {
              const weekProblems = problems.filter((p) => p.weekNo === wn)
              return (
                <th
                  key={wn}
                  colSpan={weekProblems.length}
                  className="border-l border-slate-200 px-3 py-2 text-center"
                >
                  สัปดาห์ {wn}
                </th>
              )
            })}
            <th className="border-l border-slate-200 px-4 py-2 text-right">รวม</th>
          </tr>
          {/* Problem title row */}
          <tr className="bg-slate-50 text-xs text-slate-400">
            {problems.map((p) => (
              <th
                key={p.id}
                className="border-l border-slate-200 px-3 py-1.5 text-center font-medium max-w-[80px] truncate"
                title={p.title}
              >
                {p.title}
                <br />
                <span className="font-normal text-slate-300">/{p.pointsMax}</span>
              </th>
            ))}
            <th className="border-l border-slate-200 px-4 py-1.5 text-right font-medium">
              /{problems.reduce((s, p) => s + p.pointsMax, 0)}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {students.map((student) => {
            const total = problems.reduce((sum, p) => {
              const s = student.scores[p.id]
              return sum + (s ?? 0)
            }, 0)
            const totalMax = problems.reduce((s, p) => s + p.pointsMax, 0)
            const allDone = problems.every((p) => student.scores[p.id] != null)

            return (
              <tr key={student.userId} className="hover:bg-slate-50">
                <td className="sticky left-0 z-10 bg-white px-5 py-3 hover:bg-slate-50">
                  <p className="font-medium text-slate-700">{student.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{student.idCode ?? "–"}</p>
                </td>
                {problems.map((p) => (
                  <td key={p.id} className="border-l border-slate-100 px-3 py-3 text-center">
                    {scoreCell(student.scores[p.id], p.pointsMax)}
                  </td>
                ))}
                <td className="border-l border-slate-200 px-4 py-3 text-right font-semibold">
                  <span className={allDone && total === totalMax ? "text-green-600" : "text-slate-700"}>
                    {total}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
