"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FaPlus, FaPen, FaTrash, FaUsers, FaCopy } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"
import { ConfirmDialog } from "@/components/shell/ConfirmDialog"
import { CourseFormDialog, type CourseValue } from "./CourseFormDialog"
import { CourseStaffDialog } from "./CourseStaffDialog"
import { CourseDuplicateDialog } from "./CourseDuplicateDialog"

type DialogState = { mode: "create" } | { mode: "edit"; course: CourseValue } | null
type CascadeCounts = { students: number; problems: number; submissions: number }

export function CoursesTable({ openCreate = false }: { openCreate?: boolean }) {
  const { notify } = useToast()
  const router = useRouter()
  const [courses, setCourses] = useState<CourseValue[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dialog, setDialog] = useState<DialogState>(openCreate ? { mode: "create" } : null)
  const [deleteTarget, setDeleteTarget] = useState<{ course: CourseValue; counts: CascadeCounts } | null>(null)
  const [staffTarget, setStaffTarget] = useState<CourseValue | null>(null)
  const [duplicateTarget, setDuplicateTarget] = useState<CourseValue | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [checking, setChecking] = useState<string | null>(null)
  // Refresh this client table AND the server-rendered shell, so the navbar
  // course switcher (fed by the layout's getCourseContext) updates immediately
  // rather than only on the next full page load.
  const reload = () => {
    setRefreshKey((k) => k + 1)
    router.refresh()
  }

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

  async function deleteCourse(course: CourseValue) {
    const res = await fetch(`/api/courses/${course.code}/${course.year}/${course.semester}`, { method: "DELETE" })
    if (!res.ok) throw new Error()
    notify("success", "ลบรายวิชาแล้ว")
    reload()
  }

  // Clicking the trash icon first asks the server what would cascade. An empty
  // course (no students/problems/submissions) is deleted straight away; one
  // with data opens a confirmation dialog spelling out what will be lost.
  async function requestDelete(course: CourseValue) {
    const slug = `${course.code}/${course.year}/${course.semester}`
    setChecking(slug)
    try {
      const res = await fetch(`/api/courses/${slug}`)
      if (!res.ok) throw new Error()
      const { counts } = (await res.json()) as { counts: CascadeCounts }
      if (counts.students === 0 && counts.problems === 0 && counts.submissions === 0) {
        await deleteCourse(course)
      } else {
        setDeleteTarget({ course, counts })
      }
    } catch {
      notify("error", "ไม่สามารถลบรายวิชาได้")
    } finally {
      setChecking(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteCourse(deleteTarget.course)
      setDeleteTarget(null)
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
              <th className="px-4 py-3 text-left font-medium">ปี/ภาค</th>
              <th className="px-4 py-3 text-left font-medium">ชื่อวิชา</th>
              <th className="px-4 py-3 text-left font-medium">หลักสูตร</th>
              <th className="px-4 py-3 text-center font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  กำลังโหลด...
                </td>
              </tr>
            ) : courses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  ยังไม่มีรายวิชา — กด “เพิ่มรายวิชา” เพื่อเริ่มต้น
                </td>
              </tr>
            ) : (
              courses.map((c) => (
                <tr key={`${c.code}/${c.year}/${c.semester}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-600">{c.code}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{c.year}/{c.semester}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{c.nameTh}</div>
                    <div className="text-xs text-slate-400">{c.nameEn}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{c.program ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setStaffTarget(c)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                        aria-label="ผู้สอน"
                      >
                        <FaUsers className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDuplicateTarget(c)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                        aria-label="ทำซ้ำไปภาคใหม่"
                      >
                        <FaCopy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDialog({ mode: "edit", course: c })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-secondary"
                        aria-label="แก้ไข"
                      >
                        <FaPen className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => requestDelete(c)}
                        disabled={checking === `${c.code}/${c.year}/${c.semester}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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

      {duplicateTarget && (
        <CourseDuplicateDialog
          source={duplicateTarget}
          onClose={() => setDuplicateTarget(null)}
          onSaved={reload}
        />
      )}

      {staffTarget && (
        <CourseStaffDialog
          courseSlug={`${staffTarget.code}/${staffTarget.year}/${staffTarget.semester}`}
          courseLabel={`${staffTarget.code} · ${staffTarget.nameTh}`}
          onClose={() => setStaffTarget(null)}
          onSaved={reload}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="ลบรายวิชา"
          message={
            `ต้องการลบ ${deleteTarget.course.code} · ${deleteTarget.course.nameTh} ใช่หรือไม่?\n\n` +
            `ข้อมูลต่อไปนี้จะถูกลบไปด้วยและไม่สามารถกู้คืนได้:\n` +
            [
              deleteTarget.counts.students > 0 && `• นักศึกษา ${deleteTarget.counts.students} คน`,
              deleteTarget.counts.problems > 0 && `• โจทย์ ${deleteTarget.counts.problems} ข้อ`,
              deleteTarget.counts.submissions > 0 && `• การส่งคำตอบ ${deleteTarget.counts.submissions} รายการ`,
            ]
              .filter(Boolean)
              .join("\n")
          }
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          busy={deleting}
        />
      )}
    </div>
  )
}
