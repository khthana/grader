"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FaFileImport, FaEye } from "react-icons/fa"
import { QuizQuestionList } from "./QuizQuestionList"
import { useToast } from "@/components/shell/ToastProvider"
import type { QuizDraft } from "@/lib/quizzes/import"

export interface WeekOption {
  id: number
  weekNo: number
  topic: string
}

type Preview = { draft: QuizDraft; notices: string[] }

/**
 * Paste or upload the instructor's import JSON, preview it, then save.
 * `create` makes a new Quiz; `reimport` replaces an existing Quiz's questions.
 */
export function QuizImportForm({
  courseSlug,
  coursePath,
  weeks,
  mode,
  quizId,
  quizDontKnowEnabled = true,
  onSaved,
}: {
  courseSlug: string
  coursePath: string
  weeks: WeekOption[]
  mode: "create" | "reimport"
  quizId?: number
  /** reimport: the Quiz's own setting, so the preview matches it. */
  quizDontKnowEnabled?: boolean
  onSaved?: () => void
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [raw, setRaw] = useState("")
  const [weekId, setWeekId] = useState<number | null>(null)
  const [dontKnowEnabled, setDontKnowEnabled] = useState(true)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  function parseRaw(): unknown {
    try {
      return JSON.parse(raw)
    } catch {
      setPreview(null)
      setErrors(["JSON ไม่ถูกต้อง — ตรวจสอบเครื่องหมายวงเล็บและจุลภาค"])
      return undefined
    }
  }

  async function handleFile(file: File) {
    setRaw(await file.text())
    setPreview(null)
    setErrors([])
  }

  async function handlePreview() {
    const data = parseRaw()
    if (data === undefined) return
    setBusy(true)
    const res = await fetch(`/api/courses/${courseSlug}/quizzes/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    })
    setBusy(false)
    const body = await res.json().catch(() => ({}))
    if (res.ok) {
      setPreview(body as Preview)
      setErrors([])
    } else {
      setPreview(null)
      setErrors(body.errors ?? [body.error ?? "ตรวจไม่สำเร็จ"])
    }
  }

  async function handleSave() {
    const data = parseRaw()
    if (data === undefined) return
    setBusy(true)
    const res =
      mode === "create"
        ? await fetch(`/api/courses/${courseSlug}/quizzes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data, weekId, dontKnowEnabled }),
          })
        : await fetch(`/api/courses/${courseSlug}/quizzes/${quizId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data }),
          })
    setBusy(false)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setErrors(body.errors ?? [body.error ?? "บันทึกไม่สำเร็จ"])
      return
    }
    if (mode === "create") {
      notify("success", `สร้างแบบทดสอบ "${body.quiz.title}" เรียบร้อยแล้ว`)
      router.push(`${coursePath}/quizzes/${body.quiz.id}`)
      router.refresh()
    } else {
      notify("success", "นำเข้าข้อสอบใหม่เรียบร้อยแล้ว")
      setRaw("")
      setPreview(null)
      onSaved?.()
    }
  }

  return (
    <div className="flex flex-col gap-4 font-thai">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            วางหรืออัปโหลด JSON ในรูปแบบ <code className="rounded bg-slate-100 px-1">DATA</code> เดียวกับสคริปต์
            Google Form (title, description, questions)
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50">
            <FaFileImport className="h-3.5 w-3.5" />
            เลือกไฟล์ .json
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
                e.target.value = ""
              }}
            />
          </label>
        </div>
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value)
            setPreview(null)
          }}
          rows={10}
          spellCheck={false}
          placeholder='{ "title": "...", "questions": [ ... ] }'
          className="mt-3 w-full rounded-lg border border-gray-300 p-3 font-mono text-xs focus:border-secondary focus:outline-none"
        />

        {mode === "create" && (
          <div className="mt-3 flex flex-wrap items-center gap-6 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              สัปดาห์
              <select
                value={weekId ?? ""}
                onChange={(e) => setWeekId(e.target.value ? Number(e.target.value) : null)}
                className="rounded-lg border border-gray-300 px-2 py-1"
              >
                <option value="">ไม่ระบุ</option>
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    สัปดาห์ที่ {w.weekNo}
                    {w.topic ? ` · ${w.topic}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={dontKnowEnabled}
                onChange={(e) => setDontKnowEnabled(e.target.checked)}
              />
              มีตัวเลือก &quot;ไม่ทราบ&quot; ทุกข้อ
            </label>
          </div>
        )}

        {errors.length > 0 && (
          <ul className="mt-3 list-disc rounded-lg bg-red-50 py-2 pl-8 pr-3 text-sm text-red-700">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={handlePreview}
            disabled={busy || !raw.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <FaEye className="h-3.5 w-3.5" />
            ดูตัวอย่าง
          </button>
          <button
            onClick={handleSave}
            disabled={busy || !preview}
            title={preview ? undefined : "กดดูตัวอย่างก่อนบันทึก"}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primary-hover disabled:opacity-50"
          >
            {mode === "create" ? "บันทึกแบบทดสอบ" : "แทนที่ข้อสอบทั้งหมด"}
          </button>
        </div>
      </div>

      {preview && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-primary">{preview.draft.title}</h2>
            {preview.draft.description && (
              <p className="mt-1 whitespace-pre-line text-sm text-slate-500">{preview.draft.description}</p>
            )}
            <p className="mt-2 text-sm text-slate-600">{preview.draft.questions.length} ข้อ</p>
            {preview.notices.map((n) => (
              <p key={n} className="mt-2 rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                {n}
              </p>
            ))}
          </div>
          <QuizQuestionList
            questions={preview.draft.questions}
            dontKnowEnabled={mode === "create" ? dontKnowEnabled : quizDontKnowEnabled}
          />
        </div>
      )}
    </div>
  )
}
