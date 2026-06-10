"use client"

import { useEffect, useState } from "react"
import { FaChevronLeft, FaChevronRight } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"

interface LogEntry {
  id: number
  actorEmail: string | null
  action: string
  targetEmail: string | null
  createdAt: string
}

interface ListResponse {
  logs: LogEntry[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

const ACTIONS: { value: string; label: string }[] = [
  { value: "", label: "ทุกกิจกรรม" },
  { value: "user.create", label: "เพิ่มผู้ใช้" },
  { value: "user.update", label: "แก้ไขผู้ใช้" },
  { value: "user.delete", label: "ลบผู้ใช้" },
  { value: "user.roles", label: "เปลี่ยนบทบาท" },
  { value: "login", label: "เข้าสู่ระบบ" },
]

const ACTION_LABEL: Record<string, string> = Object.fromEntries(
  ACTIONS.filter((a) => a.value).map((a) => [a.value, a.label])
)

const ACTION_BADGE: Record<string, string> = {
  "user.create": "bg-green-100 text-green-800",
  "user.update": "bg-blue-100 text-secondary",
  "user.delete": "bg-red-100 text-red-700",
  "user.roles": "bg-indigo-100 text-indigo-800",
  login: "bg-slate-100 text-slate-600",
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("th-TH")
}

export function LogsView() {
  const { notify } = useToast()
  const [action, setAction] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListResponse>({ logs: [], total: 0, page: 1, pageSize: PAGE_SIZE })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const params = new URLSearchParams({ action, page: String(page), pageSize: String(PAGE_SIZE) })
      try {
        const res = await fetch(`/api/logs?${params}`)
        if (!res.ok) throw new Error()
        const json = (await res.json()) as ListResponse
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) notify("error", "ไม่สามารถโหลดบันทึกกิจกรรมได้")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [action, page, notify])

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <div className="font-thai">
      <div className="mb-4 flex items-center justify-between gap-4">
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value)
            setPage(1)
          }}
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-400">ทั้งหมด {data.total} รายการ</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">เวลา</th>
              <th className="px-4 py-3 text-left font-medium">ผู้กระทำ</th>
              <th className="px-4 py-3 text-left font-medium">กิจกรรม</th>
              <th className="px-4 py-3 text-left font-medium">เป้าหมาย</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">กำลังโหลด...</td>
              </tr>
            ) : data.logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">ไม่มีบันทึกกิจกรรม</td>
              </tr>
            ) : (
              data.logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatTime(log.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{log.actorEmail ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ACTION_BADGE[log.action] ?? "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {ACTION_LABEL[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{log.targetEmail ?? "—"}</td>
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
