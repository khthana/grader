"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useToast } from "@/components/shell/ToastProvider"
import { DONT_KNOW, type QuizAnswers } from "@/lib/quizzes/attempt"
import { DONT_KNOW_TEXT, dontKnowLetter } from "@/lib/quizzes/import"
import { QUIZ_ROUND_LABEL, type QuizRound, type RoundWindowState } from "@/lib/quizzes/round-window"
import type { StudentAttempt, StudentQuiz } from "@/lib/quizzes/result-view"
import { RoundStateBadge } from "./RoundStateBadge"
import { OutcomeBadge } from "./OutcomeBadge"

interface AttemptPayload {
  state: RoundWindowState
  quiz: StudentQuiz
  attempt: StudentAttempt | null
}

/**
 * A Student taking one Quiz Round: answers save as they go, submit once every
 * question is answered. `preview` (staff) renders the same page from the given
 * Quiz with answers kept in the browser only — no attempt is ever created.
 */
export function QuizTaker({
  courseSlug,
  quizPath,
  quizId,
  round,
  preview,
}: {
  courseSlug: string
  quizPath: string
  quizId: number
  round: QuizRound
  preview?: StudentQuiz
}) {
  const { notify } = useToast()
  const [data, setData] = useState<AttemptPayload | null>(
    preview ? { state: "open", quiz: preview, attempt: null } : null
  )
  const [answers, setAnswers] = useState<QuizAnswers>({})
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const api = `/api/courses/${courseSlug}/quizzes/${quizId}/${round}/attempt`

  useEffect(() => {
    if (preview) return
    let cancelled = false
    fetch(api)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(body.error ?? "เปิดแบบทดสอบไม่สำเร็จ")
          return
        }
        setData(body)
        setAnswers(body.attempt?.answers ?? {})
      })
      .catch(() => !cancelled && setError("เปิดแบบทดสอบไม่สำเร็จ"))
    return () => {
      cancelled = true
    }
  }, [api, preview])

  async function choose(questionId: number, answer: string) {
    const previous = answers
    setAnswers((a) => ({ ...a, [questionId]: answer }))
    if (preview) return
    setSaving(true)
    const res = await fetch(api, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: { [questionId]: answer } }),
    })
    setSaving(false)
    const body = await res.json().catch(() => ({}))
    if (res.ok) {
      setData(body)
    } else {
      setAnswers(previous)
      notify("error", body.error ?? "บันทึกคำตอบไม่สำเร็จ")
      if (res.status === 403) setData((d) => (d ? { ...d, state: "closed" } : d))
    }
  }

  async function submit() {
    if (preview) {
      notify("success", "นี่คือตัวอย่าง — ไม่มีการส่งคำตอบจริง")
      return
    }
    setSubmitting(true)
    const res = await fetch(`${api}/submit`, { method: "POST" })
    setSubmitting(false)
    const body = await res.json().catch(() => ({}))
    if (res.ok) {
      setData(body)
      notify("success", "ส่งคำตอบเรียบร้อยแล้ว")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      notify("error", body.error ?? "ส่งคำตอบไม่สำเร็จ")
    }
  }

  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-slate-500">
        {error}
        <div className="mt-4">
          <Link href={quizPath} className="text-secondary hover:underline">
            กลับไปหน้าแบบทดสอบ
          </Link>
        </div>
      </div>
    )
  }
  if (!data) return <p className="text-sm text-slate-400">กำลังโหลด...</p>

  const { quiz, attempt, state } = data
  const submitted = attempt?.submitted ?? false
  const editable = !submitted && state === "open"
  const missing = quiz.questions.filter((q) => answers[q.id] === undefined).length
  const outcomes = new Map(attempt?.result?.outcomes.map((o) => [o.questionId, o.outcome]))

  return (
    <div className="flex flex-col gap-4 font-thai">
      {preview && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          ตัวอย่างมุมมองนักศึกษา — คำตอบไม่ถูกบันทึก และไม่สร้างการทำแบบทดสอบ
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <span className="font-medium text-slate-700">{QUIZ_ROUND_LABEL[round]}</span>
        <RoundStateBadge state={state} />
        {attempt?.result && (
          <span className="text-sm text-slate-600">
            ส่งแล้ว · ได้ <span className="font-semibold text-primary">{attempt.result.score}</span>/
            {attempt.result.max} คะแนน
          </span>
        )}
        {!attempt && state !== "open" && !preview && (
          <span className="text-sm text-slate-500">
            {state === "closed" ? "รอบนี้ปิดแล้ว และคุณไม่ได้ทำ" : "รอบนี้ยังไม่เปิด"}
          </span>
        )}
        {editable && <span className="text-xs text-slate-400">{saving ? "กำลังบันทึก..." : "บันทึกคำตอบอัตโนมัติ"}</span>}
      </div>

      {quiz.description && (
        <p className="whitespace-pre-line rounded-xl border border-gray-200 bg-white p-5 text-sm text-slate-600">
          {quiz.description}
        </p>
      )}

      {(attempt || preview) && (
        <ol className="flex flex-col gap-4">
          {quiz.questions.map((q, i) => {
            const outcome = outcomes.get(q.id)
            const options = [
              ...q.choices.map((c) => ({ value: c.letter, letter: c.letter, text: c.text })),
              ...(quiz.dontKnowEnabled
                ? [{ value: DONT_KNOW, letter: dontKnowLetter(q.choices), text: DONT_KNOW_TEXT }]
                : []),
            ]
            return (
              <li key={q.id} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-semibold text-primary">ข้อ {i + 1}.</span>
                  {q.topic && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{q.topic}</span>
                  )}
                  {outcome && <OutcomeBadge outcome={outcome} className="ml-auto" />}
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{q.prompt}</p>
                {q.code && (
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100">
                    {q.code}
                  </pre>
                )}
                <div className="mt-3 flex flex-col gap-1.5">
                  {options.map((o) => {
                    const checked = answers[q.id] === o.value
                    return (
                      <label
                        key={o.value}
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                          checked ? "border-secondary bg-blue-50" : "border-gray-200"
                        } ${editable || preview ? "cursor-pointer hover:bg-slate-50" : "cursor-default"} ${
                          o.value === DONT_KNOW ? "italic text-slate-500" : "text-slate-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={checked}
                          disabled={!(editable || preview) || saving}
                          onChange={() => choose(q.id, o.value)}
                          className="mt-0.5"
                        />
                        <span className="font-medium">{o.letter}.</span>
                        <span className="flex-1 whitespace-pre-wrap">{o.text}</span>
                      </label>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {(editable || preview) && (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <span className="text-sm text-slate-500">
            {missing > 0 ? `ยังไม่ได้ตอบ ${missing} ข้อ` : "ตอบครบทุกข้อแล้ว"}
          </span>
          <button
            onClick={submit}
            disabled={missing > 0 || submitting || saving}
            className="rounded-lg bg-primary px-5 py-2 text-sm text-white transition hover:bg-primary-hover disabled:opacity-50"
          >
            {submitting ? "กำลังส่ง..." : "ส่งคำตอบ"}
          </button>
        </div>
      )}

      <Link href={quizPath} className="w-fit text-sm text-secondary hover:underline">
        ← กลับไปหน้าแบบทดสอบ
      </Link>
    </div>
  )
}
