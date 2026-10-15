"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FaTrash, FaFileImport, FaEye } from "react-icons/fa"
import { QuizQuestionList } from "./QuizQuestionList"
import { QuizImportForm, type WeekOption } from "./QuizImportForm"
import { QuizWindowsGrid } from "./QuizWindowsGrid"
import { ConfirmDialog } from "@/components/shell/ConfirmDialog"
import { useToast } from "@/components/shell/ToastProvider"
import type { QuizDetail as QuizData } from "@/lib/quizzes/repository"

type StaffQuiz = QuizData & { locked: boolean }

export function QuizDetail({
  initialQuiz,
  courseSlug,
  coursePath,
  weeks,
  canManage,
}: {
  initialQuiz: StaffQuiz
  courseSlug: string
  coursePath: string
  weeks: WeekOption[]
  canManage: boolean
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [quiz, setQuiz] = useState(initialQuiz)
  const [title, setTitle] = useState(quiz.title)
  const [description, setDescription] = useState(quiz.description)
  const [weekId, setWeekId] = useState<number | null>(quiz.weekId)
  const [dontKnowEnabled, setDontKnowEnabled] = useState(quiz.dontKnowEnabled)
  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const api = `/api/courses/${courseSlug}/quizzes/${quiz.id}`

  async function reload() {
    const res = await fetch(api)
    if (res.ok) setQuiz((await res.json()).quiz)
    setShowImport(false)
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch(api, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, weekId, dontKnowEnabled }),
    })
    setSaving(false)
    const body = await res.json().catch(() => ({}))
    if (res.ok) {
      setQuiz(body.quiz)
      notify("success", "บันทึกเรียบร้อยแล้ว")
    } else {
      notify("error", body.error ?? "บันทึกไม่สำเร็จ")
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(api, { method: "DELETE" })
    setDeleting(false)
    setConfirmDelete(false)
    if (res.ok) {
      notify("success", `ลบแบบทดสอบ "${quiz.title}" เรียบร้อยแล้ว`)
      router.push(`${coursePath}/quizzes`)
      router.refresh()
    } else {
      notify("error", "ลบแบบทดสอบไม่สำเร็จ")
    }
  }

  return (
    <div className="flex flex-col gap-4 font-thai">
      {canManage ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-slate-600 md:col-span-2">
              ชื่อแบบทดสอบ
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-slate-700 focus:border-secondary focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600 md:col-span-2">
              คำอธิบาย
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="rounded-lg border border-gray-300 px-3 py-2 text-slate-700 focus:border-secondary focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
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
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={dontKnowEnabled}
                onChange={(e) => setDontKnowEnabled(e.target.checked)}
              />
              มีตัวเลือก &quot;ไม่ทราบ&quot; ทุกข้อ
            </label>
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowImport((v) => !v)}
                disabled={quiz.locked}
                title={quiz.locked ? "มีนักศึกษาเริ่มทำแล้ว นำเข้าข้อสอบใหม่ไม่ได้" : undefined}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaFileImport className="h-3.5 w-3.5" />
                นำเข้าข้อสอบใหม่
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
              >
                <FaTrash className="h-3.5 w-3.5" />
                ลบ
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          {quiz.description && <p className="whitespace-pre-line text-sm text-slate-500">{quiz.description}</p>}
          <p className="mt-2 text-sm text-slate-600">
            สัปดาห์: {quiz.weekNo ?? "ไม่ระบุ"} · ตัวเลือก &quot;ไม่ทราบ&quot;: {quiz.dontKnowEnabled ? "มี" : "ไม่มี"}
          </p>
        </div>
      )}

      {canManage && showImport && !quiz.locked && (
        <QuizImportForm
          courseSlug={courseSlug}
          coursePath={coursePath}
          weeks={weeks}
          mode="reimport"
          quizId={quiz.id}
          quizDontKnowEnabled={quiz.dontKnowEnabled}
          onSaved={reload}
        />
      )}

      <QuizWindowsGrid courseSlug={courseSlug} quizId={quiz.id} canManage={canManage} />

      <div className="mt-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-600">ข้อสอบ {quiz.questions.length} ข้อ (พร้อมเฉลย)</h2>
        <Link
          href={`${coursePath}/quizzes/${quiz.id}/pre`}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <FaEye className="h-3.5 w-3.5" />
          ดูตัวอย่าง (มุมมองนักศึกษา)
        </Link>
      </div>
      <QuizQuestionList questions={quiz.questions} dontKnowEnabled={quiz.dontKnowEnabled} />

      {confirmDelete && (
        <ConfirmDialog
          title="ลบแบบทดสอบ"
          message={`ต้องการลบแบบทดสอบ "${quiz.title}" ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
          confirmLabel="ลบแบบทดสอบ"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
          busy={deleting}
          confirmText={quiz.locked ? quiz.title : undefined}
        />
      )}
    </div>
  )
}
