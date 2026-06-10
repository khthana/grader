"use client"

import { useEffect, useState } from "react"
import { FaSearch, FaChevronLeft, FaChevronRight } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"

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
  }, [debounced, page, notify])

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
        <span className="shrink-0 text-sm text-slate-400">ทั้งหมด {data.total} คน</span>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  กำลังโหลด...
                </td>
              </tr>
            ) : data.users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
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
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {u.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
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
    </div>
  )
}
