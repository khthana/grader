"use client"

import { useEffect, useState } from "react"
import { FaSearch, FaChevronLeft, FaChevronRight, FaPlus, FaPen, FaTrash, FaUserShield, FaFileExcel } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"
import { UserFormDialog } from "./UserFormDialog"
import { RolesDialog } from "./RolesDialog"
import { ImportDialog } from "./ImportDialog"
import { ConfirmDialog } from "@/components/shell/ConfirmDialog"

type DialogState = { mode: "create" } | { mode: "edit"; id: number } | null

interface UserRow {
  id: number
  name: string
  email: string
  idCode: string | null
  isActive: boolean
  roles: string[]
}

interface ListResponse {
  users: UserRow[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 10

const ROLE_BADGE: Record<string, string> = {
  Admin: "bg-indigo-100 text-indigo-800",
  Instructor: "bg-green-100 text-green-800",
  TA: "bg-blue-100 text-secondary",
  Student: "bg-pink-100 text-pink-800",
}

export function UsersTable() {
  const { notify } = useToast()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListResponse>({ users: [], total: 0, page: 1, pageSize: PAGE_SIZE })
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [rolesTarget, setRolesTarget] = useState<UserRow | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const reload = () => setRefreshKey((k) => k + 1)

  // Debounce search; reset to page 1 whenever the query changes.
  const [debounced, setDebounced] = useState("")
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const params = new URLSearchParams({
        search: debounced,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      try {
        const res = await fetch(`/api/users?${params}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as ListResponse
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) notify("error", "ไม่สามารถโหลดรายชื่อผู้ใช้ได้")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [debounced, page, notify, refreshKey])

  async function toggleActive(user: UserRow) {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      if (!res.ok) throw new Error()
      notify("success", user.isActive ? "ปิดใช้งานผู้ใช้แล้ว" : "เปิดใช้งานผู้ใช้แล้ว")
      reload()
    } catch {
      notify("error", "ไม่สามารถเปลี่ยนสถานะได้")
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      notify("success", "ลบผู้ใช้แล้ว")
      setDeleteTarget(null)
      reload()
    } catch {
      notify("error", "ไม่สามารถลบผู้ใช้ได้")
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <div className="font-thai">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <FaSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ อีเมล หรือรหัส"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <span className="text-sm text-slate-400">ทั้งหมด {data.total} คน</span>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <FaFileExcel className="h-3.5 w-3.5 text-green-600" /> นำเข้า Excel
          </button>
          <button
            onClick={() => setDialog({ mode: "create" })}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <FaPlus className="h-3 w-3" /> เพิ่มผู้ใช้
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">ชื่อ</th>
              <th className="px-4 py-3 text-left font-medium">อีเมล</th>
              <th className="px-4 py-3 text-left font-medium">รหัส</th>
              <th className="px-4 py-3 text-left font-medium">บทบาท</th>
              <th className="px-4 py-3 text-center font-medium">สถานะ</th>
              <th className="px-4 py-3 text-center font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  กำลังโหลด...
                </td>
              </tr>
            ) : data.users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  ไม่พบผู้ใช้
                </td>
              </tr>
            ) : (
              data.users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{u.idCode ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        u.roles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              ROLE_BADGE[role] ?? "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {role}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(u)}
                      title={u.isActive ? "คลิกเพื่อปิดใช้งาน" : "คลิกเพื่อเปิดใช้งาน"}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {u.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setDialog({ mode: "edit", id: u.id })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-secondary"
                        aria-label="แก้ไข"
                      >
                        <FaPen className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setRolesTarget(u)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                        aria-label="จัดการบทบาท"
                      >
                        <FaUserShield className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
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

      <div className="mt-4 flex items-center justify-end gap-3 text-sm">
        <span className="text-slate-500">
          หน้า {data.total === 0 ? 0 : page} / {data.total === 0 ? 0 : totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
          aria-label="ก่อนหน้า"
        >
          <FaChevronLeft className="h-3 w-3" />
        </button>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
          aria-label="ถัดไป"
        >
          <FaChevronRight className="h-3 w-3" />
        </button>
      </div>

      {dialog && (
        <UserFormDialog
          mode={dialog.mode}
          userId={dialog.mode === "edit" ? dialog.id : undefined}
          onClose={() => setDialog(null)}
          onSaved={reload}
        />
      )}

      {importOpen && (
        <ImportDialog onClose={() => setImportOpen(false)} onImported={reload} />
      )}

      {rolesTarget && (
        <RolesDialog
          userId={rolesTarget.id}
          userName={rolesTarget.name}
          currentRoles={rolesTarget.roles}
          onClose={() => setRolesTarget(null)}
          onSaved={reload}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="ยืนยันการลบ"
          message={`ต้องการลบผู้ใช้ "${deleteTarget.name}" ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          busy={deleting}
        />
      )}
    </div>
  )
}
