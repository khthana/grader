"use client"

import { useEffect, useState } from "react"
import {
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaFileExcel,
  FaDownload,
  FaPen,
  FaTrash,
} from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"
import { StudentFormDialog } from "./StudentFormDialog"
import { RosterImportDialog } from "./RosterImportDialog"
import { ConfirmDialog } from "@/components/shell/ConfirmDialog"

interface RosterRow {
  id: number
  userId: number
  sid: string | null
  prefix: string | null
  name: string
  program: string | null
  studyGroup: string | null
  year: string | null
}

interface ListResponse {
  enrollments: RosterRow[]
  total: number
  page: number
  pageSize: number
  groups: string[]
}

const PAGE_SIZE = 10

export function RosterTable({ courseId, canMutate }: { courseId: number; canMutate: boolean }) {
  const { notify } = useToast()
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [group, setGroup] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListResponse>({
    enrollments: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    groups: [],
  })
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RosterRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RosterRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const reload = () => setRefreshKey((k) => k + 1)

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/courses/${courseId}/students/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error()
      notify("success", "นำนักศึกษาออกจากรายวิชาแล้ว")
      setDeleteTarget(null)
      reload()
    } catch {
      notify("error", "ไม่สามารถนำออกได้")
    } finally {
      setDeleting(false)
    }
  }

  // Debounce search; reset to page 1 whenever the query changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  function changeGroup(value: string) {
    setGroup(value)
    setPage(1)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const params = new URLSearchParams({
        search: debounced,
        group,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      try {
        const res = await fetch(`/api/courses/${courseId}/students?${params}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as ListResponse
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) notify("error", "ไม่สามารถโหลดรายชื่อนักศึกษาได้")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [courseId, debounced, group, page, notify, refreshKey])

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
  const filtering = debounced.trim() !== "" || group !== ""
  const colCount = canMutate ? 8 : 7

  return (
    <div className="font-thai">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <FaSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหารหัส หรือชื่อนักศึกษา"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <select
            value={group}
            onChange={(e) => changeGroup(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">ทุกกลุ่มเรียน</option>
            {data.groups.map((g) => (
              <option key={g} value={g}>
                กลุ่ม {g}
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-400">ทั้งหมด {data.total} คน</span>
          {canMutate && (
            <>
              <button
                disabled
                title="กำลังพัฒนา"
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-400 opacity-60"
              >
                <FaDownload className="h-3 w-3" /> ส่งออก
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <FaFileExcel className="h-3.5 w-3.5 text-green-600" /> นำเข้า Excel
              </button>
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
              >
                <FaPlus className="h-3 w-3" /> เพิ่มนักศึกษา
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">#</th>
              <th className="px-4 py-3 text-left font-medium">รหัสนักศึกษา</th>
              <th className="px-4 py-3 text-left font-medium">คำนำหน้า</th>
              <th className="px-4 py-3 text-left font-medium">ชื่อ - นามสกุล</th>
              <th className="px-4 py-3 text-left font-medium">หลักสูตร</th>
              <th className="px-4 py-3 text-left font-medium">กลุ่ม</th>
              <th className="px-4 py-3 text-left font-medium">ปีการศึกษา</th>
              {canMutate && <th className="px-4 py-3 text-center font-medium">จัดการ</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-12 text-center text-slate-400">
                  กำลังโหลด...
                </td>
              </tr>
            ) : data.enrollments.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-12 text-center text-slate-400">
                  {filtering ? "ไม่พบนักศึกษาที่ค้นหา" : "ยังไม่มีนักศึกษาในรายวิชานี้"}
                </td>
              </tr>
            ) : (
              data.enrollments.map((e, i) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{e.sid ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{e.prefix ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{e.name}</td>
                  <td className="px-4 py-3 text-slate-400">{e.program ?? "—"}</td>
                  <td className="px-4 py-3">
                    {e.studyGroup ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-secondary">
                        {e.studyGroup}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{e.year ?? "—"}</td>
                  {canMutate && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditTarget(e)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-secondary"
                          aria-label="แก้ไข"
                        >
                          <FaPen className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(e)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                          aria-label="นำออกจากรายวิชา"
                        >
                          <FaTrash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3 text-sm">
        <span className="text-slate-500">
          หน้า {data.total === 0 ? 0 : page} / {data.total === 0 ? 0 : totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          aria-label="ก่อนหน้า"
        >
          <FaChevronLeft className="h-3 w-3" />
        </button>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          aria-label="ถัดไป"
        >
          <FaChevronRight className="h-3 w-3" />
        </button>
      </div>

      {addOpen && (
        <StudentFormDialog
          courseId={courseId}
          onClose={() => setAddOpen(false)}
          onSaved={reload}
        />
      )}

      {importOpen && (
        <RosterImportDialog
          courseId={courseId}
          onClose={() => setImportOpen(false)}
          onImported={reload}
        />
      )}

      {editTarget && (
        <StudentFormDialog
          courseId={courseId}
          enrollment={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={reload}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="นำออกจากรายวิชา"
          message={`ต้องการลบ ${deleteTarget.name} (${deleteTarget.sid ?? "—"}) ออกจากรายวิชาใช่หรือไม่?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          busy={deleting}
        />
      )}
    </div>
  )
}
