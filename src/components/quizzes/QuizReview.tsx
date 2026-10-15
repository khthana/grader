import { FaCheck } from "react-icons/fa"
import { DONT_KNOW } from "@/lib/quizzes/attempt"
import { OutcomeBadge } from "./OutcomeBadge"
import { DONT_KNOW_TEXT, dontKnowLetter } from "@/lib/quizzes/import"
import type { QuizResult, RoundAnswer, RoundScore } from "@/lib/quizzes/result-view"

function RoundCell({ label, value, dontKnow }: { label: string; value: RoundAnswer | null; dontKnow: string }) {
  if (!value) return <span className="text-xs text-slate-400">{label}: ไม่ได้ทำ</span>
  const shown = value.answer === DONT_KNOW ? dontKnow : (value.answer ?? "–")
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-600">
      {label}: <span className="font-medium">{shown}</span>
      <OutcomeBadge outcome={value.outcome} />
    </span>
  )
}

/**
 * Answer Key Release (#93): the Student's Pre vs Post per question with the
 * key and explanations — only when `result` is released (their Group's Post
 * window has closed); otherwise a note that it isn't yet.
 */
export function QuizReview({ result }: { result: QuizResult }) {
  if (!result.released) {
    return (
      <p className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-4 text-sm text-slate-500">
        เฉลยและคำอธิบายจะเปิดให้ดูหลังรอบ Post-test ของกลุ่มคุณปิดแล้ว
      </p>
    )
  }

  const score = (s: RoundScore | null) => (s ? `${s.score}/${s.max}` : "ไม่ได้ทำ")
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-medium text-slate-700">เฉลยและผล Pre-test เทียบ Post-test</h2>
        <span className="text-sm text-slate-600">Pre-test: {score(result.pre)}</span>
        <span className="text-sm text-slate-600">Post-test: {score(result.post)}</span>
      </div>
      <ol className="flex flex-col gap-4">
        {result.questions.map((q, i) => {
          const dontKnow = `${dontKnowLetter(q.choices)} (${DONT_KNOW_TEXT})`
          return (
            <li key={q.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold text-primary">ข้อ {i + 1}.</span>
                {q.topic && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{q.topic}</span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{q.prompt}</p>
              {q.code && (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100">
                  {q.code}
                </pre>
              )}
              <ul className="mt-3 flex flex-col gap-1.5">
                {q.choices.map((c) => {
                  const correct = c.letter === q.correctLetter
                  return (
                    <li
                      key={c.letter}
                      className={`flex items-start gap-2 rounded-lg px-3 py-1.5 text-sm ${
                        correct ? "bg-green-50 text-green-800" : "text-slate-600"
                      }`}
                    >
                      <span className="font-medium">{c.letter}.</span>
                      <span className="flex-1 whitespace-pre-wrap">{c.text}</span>
                      {correct && <FaCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />}
                    </li>
                  )
                })}
              </ul>
              <div className="mt-3 flex flex-wrap gap-4">
                <RoundCell label="Pre" value={q.pre} dontKnow={dontKnow} />
                <RoundCell label="Post" value={q.post} dontKnow={dontKnow} />
              </div>
              {q.feedback && (
                <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">คำอธิบาย: </span>
                  {q.feedback}
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
