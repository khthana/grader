"use client"

import { useEffect, useState } from "react"
import { FaFileExcel, FaTimes } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"
import type { QuizReport, RoundTally } from "@/lib/quizzes/report"
import { QUIZ_ROUNDS, QUIZ_ROUND_LABEL } from "@/lib/quizzes/round-window"
import type { QuizResult } from "@/lib/quizzes/result-view"
import { QuizReview } from "./QuizReview"

type Tab = "overview" | "questions" | "students"
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "ภาพรวม" },
  { key: "questions", label: "รายข้อ" },
  { key: "students", label: "รายคน" },
]

const fmt = (n: number | null, digits = 2) => (n === null ? "–" : Number.isInteger(n) ? String(n) : n.toFixed(digits))
const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100))

/**
 * Quiz Report (#94): Pre vs Post for staff (TA reads) — ภาพรวม / รายข้อ /
 * รายคน, narrowed by Group, exportable to Excel; a Student's row opens their
 * answers with the key.
 */
export function QuizReportPanel({ courseSlug, quizId }: { courseSlug: string; quizId: number }) {
  const { notify } = useToast()
  const [tab, setTab] = useState<Tab>("overview")
  const [group, setGroup] = useState<string | null>(null)
  const [report, setReport] = useState<QuizReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [student, setStudent] = useState<{ name: string; result: QuizResult | null } | null>(null)

  const api = `/api/courses/${courseSlug}/quizzes/${quizId}`
  const query = group === null ? "" : `?group=${encodeURIComponent(group)}`

  useEffect(() => {
    let cancelled = false
    fetch(`${api}/report${query}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok) setReport(body.report)
        else setError(body.error ?? "โหลดรายงานไม่สำเร็จ")
      })
      .catch(() => !cancelled && setError("โหลดรายงานไม่สำเร็จ"))
    return () => {
      cancelled = true
    }
  }, [api, query])

  async function openStudent(userId: number, name: string) {
    setStudent({ name, result: null })
    const res = await fetch(`${api}/attempts/${userId}`)
    const body = await res.json().catch(() => ({}))
    if (res.ok) setStudent({ name, result: body.result })
    else {
      setStudent(null)
      notify("error", body.error ?? "โหลดคำตอบไม่สำเร็จ")
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!report) return <p className="text-sm text-slate-400">กำลังโหลด...</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-4 py-1.5 text-sm transition ${
                tab === t.key ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          value={group ?? "*"}
          onChange={(e) => setGroup(e.target.value === "*" ? null : e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-slate-700"
        >
          <option value="*">ทุกกลุ่ม</option>
          {report.groups.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
        </select>
        <a
          href={`${api}/report/export${query}`}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <FaFileExcel className="h-3.5 w-3.5 text-green-700" />
          ส่งออก Excel
        </a>
      </div>

      {tab === "overview" && <Overview report={report} />}
      {tab === "questions" && <Questions report={report} />}
      {tab === "students" && <Students report={report} onOpen={openStudent} />}

      {student && (
        <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-8 h-fit w-full max-w-3xl rounded-xl bg-slate-50 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium text-primary">คำตอบของ {student.name}</h3>
              <button onClick={() => setStudent(null)} className="text-slate-400 hover:text-slate-600">
                <FaTimes />
              </button>
            </div>
            {student.result ? <QuizReview result={student.result} /> : <p className="text-sm text-slate-400">กำลังโหลด...</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function Overview({ report }: { report: QuizReport }) {
  const { enrolled, max } = report.overview
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {QUIZ_ROUNDS.map((round) => ({ round, r: report.overview[round] })).map(({ round, r }) => (
        <div key={round} className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-medium text-slate-600">{QUIZ_ROUND_LABEL[round]}</h3>
          <p className="mt-2 text-sm text-slate-600">
            ส่งแล้ว <span className="text-lg font-semibold text-primary">{r.submitted}</span> / {enrolled} คน
          </p>
          <p className="mt-1 text-sm text-slate-600">
            คะแนนเฉลี่ย <span className="text-lg font-semibold text-primary">{fmt(r.average)}</span> / {max}
          </p>
        </div>
      ))}
    </div>
  )
}

function TallyBar({ t }: { t: RoundTally }) {
  const total = t.correct + t.wrong + t.dontKnow + t.unanswered
  if (total === 0) return <span className="text-xs text-slate-400">ยังไม่มีผู้ส่ง</span>
  const parts = [
    { n: t.correct, cls: "bg-green-500", label: "ถูก" },
    { n: t.wrong, cls: "bg-red-400", label: "ผิด" },
    { n: t.dontKnow, cls: "bg-amber-400", label: "ไม่ทราบ" },
    { n: t.unanswered, cls: "bg-slate-300", label: "ไม่ตอบ" },
  ]
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        {parts.map((p) => (p.n > 0 ? <div key={p.label} className={p.cls} style={{ width: `${pct(p.n, total)}%` }} /> : null))}
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-slate-500">
        {parts.map((p) => (
          <span key={p.label}>
            {p.label} {p.n} ({pct(p.n, total)}%)
          </span>
        ))}
      </div>
    </div>
  )
}

function Questions({ report }: { report: QuizReport }) {
  return (
    <ol className="flex flex-col gap-3">
      {report.questions.map((q) => (
        <li key={q.id} className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-primary">ข้อ {q.no}.</span>
            {q.topic && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{q.topic}</span>}
            <span className="ml-auto text-xs text-slate-500">เฉลย {q.correctLetter}</span>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {QUIZ_ROUNDS.map((round) => (
              <div key={round} className="flex flex-col gap-2">
                <span className="text-xs font-medium text-slate-600">{QUIZ_ROUND_LABEL[round]}</span>
                <TallyBar t={q[round]} />
                <div className="flex flex-wrap gap-1.5">
                  {q.choices.map((c) => (
                    <span
                      key={c.letter}
                      title={c.text}
                      className={`rounded px-2 py-0.5 text-xs ${
                        c.letter === q.correctLetter ? "bg-green-50 text-green-700" : "bg-slate-50 text-slate-600"
                      }`}
                    >
                      {c.letter}: {q[round].choices[c.letter] ?? 0}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
  )
}

function Students({ report, onOpen }: { report: QuizReport; onOpen: (userId: number, name: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-4 py-2">รหัส</th>
            <th className="px-4 py-2">ชื่อ</th>
            <th className="px-4 py-2">กลุ่ม</th>
            <th className="px-4 py-2 text-right">Pre</th>
            <th className="px-4 py-2 text-right">Post</th>
            <th className="px-4 py-2 text-right">Post − Pre</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {report.students.map((s) => (
            <tr key={s.userId} className="border-t border-gray-100">
              <td className="px-4 py-2 text-slate-600">{s.sid ?? "–"}</td>
              <td className="px-4 py-2 text-slate-700">{s.name}</td>
              <td className="px-4 py-2 text-slate-500">{s.group}</td>
              <td className="px-4 py-2 text-right">{fmt(s.pre)}</td>
              <td className="px-4 py-2 text-right">{fmt(s.post)}</td>
              <td
                className={`px-4 py-2 text-right font-medium ${
                  s.diff === null ? "text-slate-400" : s.diff > 0 ? "text-green-600" : s.diff < 0 ? "text-red-600" : "text-slate-600"
                }`}
              >
                {s.diff === null ? "–" : s.diff > 0 ? `+${s.diff}` : s.diff}
              </td>
              <td className="px-4 py-2 text-right">
                {(s.pre !== null || s.post !== null) && (
                  <button onClick={() => onOpen(s.userId, s.name)} className="text-xs text-secondary hover:underline">
                    ดูคำตอบ
                  </button>
                )}
              </td>
            </tr>
          ))}
          {report.students.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                ไม่มีนักศึกษาในกลุ่มนี้
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
