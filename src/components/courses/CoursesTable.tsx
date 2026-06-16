"use client"

import { useEffect, useState } from "react"
import { FaPlus, FaPen, FaTrash } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"
import { ConfirmDialog } from "@/components/shell/ConfirmDialog"
import { CourseFormDialog, type CourseValue } from "./CourseFormDialog"

type DialogState = { mode: "create" } | { mode: "edit"; course: CourseValue } | null

export function CoursesTable({ openCreate = false }: { openCreate?: boolean }) {
  const { notify } = useToast()
  const [courses, setCourses] = useState<CourseValue[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dialog, setDialog] = useState<DialogState>(openCreate ? { mode: "create" } : null)
  const [deleteTarget, setDeleteTarget] = useState<CourseValue | null>(null)
  const [deleting, setDeleting] = useState(false)
  const reload = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch("/api/courses")
        if (!res.ok) throw new Error()
        const body = await res.json()
        if (!cancelled) setCourses(body.courses)
      } catch {
        if (!cancelled) notify("error", "ไม่สามารถโหลดรายวิชาได้")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [notify, refreshKey])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/courses/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      notify("success", "ลบรายวิชาแล้ว")
      setDeleteTarget(null)
      reload()
    } catch {
      notify("error", "ไม่สามารถลบรายวิชาได้")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="font-thai">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">รายวิชา</h1>
          <p className="mt-1 text-sm text-slate-500">จัดการรายวิชาที่คุณดูแล</p>
        </div>
        <button
          onClick={() => setDialog({ mode: "create" })}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <FaPlus className="h-3 w-3" /> เพิ่มรายวิชา
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">รหัสวิชา</th>
              <th className="px-4 py-3 text-left font-medium">ชื่อวิชา</th>
              <th className="px-4 py-3 text-left font-medium">หลักสูตร</th>
              <th className="px-4 py-3 text-center font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                  กำลังโหลด...
                </td>
              </tr>
            ) : courses.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                  ยังไม่มีรายวิชา — กด “เพิ่มรายวิชา” เพื่อเริ่มต้น
                </td>
              </tr>
            ) : (
              courses.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-600">{c.code}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{c.nameTh}</div>
                    <div className="text-xs text-slate-400">{c.nameEn}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{c.program ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setDialog({ mode: "edit", course: c })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-secondary"
                        aria-label="แก้ไข"
                      >
                        <FaPen className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                        aria-label="ลบ"
                      >
                        <FaTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {dialog && (
        <CourseFormDialog
          course={dialog.mode === "edit" ? dialog.course : undefined}
          onClose={() => setDialog(null)}
          onSaved={reload}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="ลบรายวิชา"
          message={`ต้องการลบ ${deleteTarget.code} · ${deleteTarget.nameTh} ใช่หรือไม่? รายชื่อนักศึกษาทั้งหมดในรายวิชานี้จะถูกลบไปด้วย`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          busy={deleting}
        />
      )}
    </div>
  )
}
