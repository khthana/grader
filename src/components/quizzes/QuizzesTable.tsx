"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FaPlus, FaTrash } from "react-icons/fa"
import { ConfirmDialog } from "@/components/shell/ConfirmDialog"
import { useToast } from "@/components/shell/ToastProvider"

interface QuizItem {
  id: number
  title: string
  description: string
  weekNo: number | null
  questionCount: number
  dontKnowEnabled: boolean
}

export function QuizzesTable({
  courseSlug,
  coursePath,
  canManage,
}: {
  courseSlug: string
  coursePath: string
  canManage: boolean
}) {
  const { notify } = useToast()
  const [quizzes, setQuizzes] = useState<QuizItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<QuizItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    return fetch(`/api/courses/${courseSlug}/quizzes`)
      .then((r) => r.json())
      .then(({ quizzes: q }: { quizzes: QuizItem[] }) => setQuizzes(q ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [courseSlug])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/courses/${courseSlug}/quizzes/${deleteTarget.id}`, { method: "DELETE" })
    setDeleting(false)
    setDeleteTarget(null)
    if (res.ok) {
      notify("success", `ลบแบบทดสอบ "${deleteTarget.title}" เรียบร้อยแล้ว`)
      load()
    } else {
      notify("error", "ลบแบบทดสอบไม่สำเร็จ")
    }
  }

  const newLink = (
    <Link
      href={`${coursePath}/quizzes/new`}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm text-white transition hover:bg-primary-hover"
    >
      <FaPlus className="h-3 w-3" />
      นำเข้าแบบทดสอบ
    </Link>
  )

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white font-thai">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <span className="text-sm font-medium text-slate-600">แบบทดสอบก่อน–หลังเรียน (Pre / Post)</span>
        {canManage && newLink}
      </div>

      {loading ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">กำลังโหลด...</div>
      ) : quizzes.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">ยังไม่มีแบบทดสอบ</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 py-3 text-left">ชื่อแบบทดสอบ</th>
              <th className="px-5 py-3 text-left">สัปดาห์</th>
              <th className="px-5 py-3 text-right">จำนวนข้อ</th>
              {canManage && <th className="px-5 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {quizzes.map((q) => (
              <tr key={q.id} className="hover:bg-slate-50">
                <td className="px-5 py-4">
                  <Link href={`${coursePath}/quizzes/${q.id}`} className="font-medium text-slate-700 hover:text-secondary">
                    {q.title}
                  </Link>
                  {q.description && <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{q.description}</p>}
                </td>
                <td className="px-5 py-4 text-slate-500">{q.weekNo ?? "–"}</td>
                <td className="px-5 py-4 text-right font-medium text-slate-700">{q.questionCount}</td>
                {canManage && (
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setDeleteTarget(q)}
                      className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      title="ลบ"
                    >
                      <FaTrash className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="ลบแบบทดสอบ"
          message={`ต้องการลบแบบทดสอบ "${deleteTarget.title}" ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
          confirmLabel="ลบแบบทดสอบ"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          busy={deleting}
        />
      )}
    </div>
  )
}
