"use client"

import { useEffect, useState } from "react"
import { FaTimes, FaSearch, FaPlus, FaUserMinus } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"

interface Staff {
  id: number
  name: string
  email: string
  roles?: string[]
}

interface Props {
  courseId: number
  courseLabel: string
  onClose: () => void
  onSaved: () => void
}

export function CourseStaffDialog({ courseId, courseLabel, onClose, onSaved }: Props) {
  const { notify } = useToast()
  const [selected, setSelected] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [candidates, setCandidates] = useState<Staff[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Load current staff.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/courses/${courseId}/instructors`)
        if (!res.ok) throw new Error()
        const body = await res.json()
        if (!cancelled) setSelected(body.instructors)
      } catch {
        if (!cancelled) notify("error", "ไม่สามารถโหลดรายชื่อผู้สอนได้")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [courseId, notify])

  // Debounced candidate search.
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search })
        const res = await fetch(`/api/courses/${courseId}/instructors/candidates?${params}`)
        if (!res.ok) throw new Error()
        const body = await res.json()
        if (!cancelled) setCandidates(body.candidates)
      } catch {
        /* ignore search errors */
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [courseId, search])

  function add(c: Staff) {
    setSelected((s) => (s.some((x) => x.id === c.id) ? s : [...s, c]))
  }
  function remove(id: number) {
    setSelected((s) => s.filter((x) => x.id !== id))
  }

  async function submit() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/courses/${courseId}/instructors`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userIds: selected.map((s) => s.id) }),
      })
      if (!res.ok) throw new Error()
      notify("success", "บันทึกผู้สอนแล้ว")
      onSaved()
      onClose()
    } catch {
      notify("error", "ไม่สามารถบันทึกได้")
    } finally {
      setSubmitting(false)
    }
  }

  const unselected = candidates.filter((c) => !selected.some((s) => s.id === c.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 font-thai">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">ผู้สอน / ผู้ช่วยสอน</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="ปิด">
            <FaTimes />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">{courseLabel}</p>

        {loading ? (
          <div className="py-12 text-center text-slate-400">กำลังโหลด...</div>
        ) : (
          <>
            <div className="mb-4">
              <span className="text-sm text-gray-500">ผู้ดูแลรายวิชา</span>
              <div className="mt-2 space-y-2">
                {selected.length === 0 && (
                  <p className="text-sm text-slate-400">ยังไม่มีผู้สอน</p>
                )}
                {selected.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-800">{s.name}</div>
                      <div className="text-xs text-slate-400">{s.email}</div>
                    </div>
                    <button
                      onClick={() => remove(s.id)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      <FaUserMinus className="h-3 w-3" /> นำออก
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mb-2">
              <FaSearch className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาผู้สอน/ผู้ช่วยสอนเพื่อเพิ่ม"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {unselected.map((c) => (
                <button
                  key={c.id}
                  onClick={() => add(c)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                >
                  <div>
                    <div className="text-sm text-slate-700">{c.name}</div>
                    <div className="text-xs text-slate-400">
                      {c.email}
                      {c.roles?.length ? ` · ${c.roles.join(", ")}` : ""}
                    </div>
                  </div>
                  <FaPlus className="h-3 w-3 text-secondary" />
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-100"
          >
            ยกเลิก
          </button>
          <button
            onClick={submit}
            disabled={submitting || loading}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {submitting ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  )
}
