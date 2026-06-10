"use client"

import { useState } from "react"
import * as XLSX from "xlsx"
import { FaTimes, FaDownload, FaFileExcel } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"

const COLUMNS = [
  "titleTh",
  "firstNameTh",
  "lastNameTh",
  "titleEn",
  "firstNameEn",
  "lastNameEn",
  "email",
  "phone",
  "idCode",
  "password",
  "roles",
]

interface RowResult {
  row: number
  status: "created" | "error"
  email: string
  errors?: Record<string, string>
}

interface ImportResponse {
  results: RowResult[]
  created: number
  failed: number
}

interface Props {
  onClose: () => void
  onImported: () => void
}

export function ImportDialog({ onClose, onImported }: Props) {
  const { notify } = useToast()
  const [rows, setRows] = useState<Record<string, string>[] | null>(null)
  const [fileName, setFileName] = useState("")
  const [results, setResults] = useState<ImportResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function downloadTemplate() {
    const example = ["นาย", "สมชาย", "ใจดี", "Mr.", "Somchai", "Jaidee", "somchai@kmitl.ac.th", "0812345678", "64010001", "", "Student"]
    const ws = XLSX.utils.aoa_to_sheet([COLUMNS, example])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "users")
    XLSX.writeFile(wb, "user-import-template.xlsx")
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResults(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "", raw: false })
      setRows(json)
    } catch {
      notify("error", "อ่านไฟล์ Excel ไม่สำเร็จ")
      setRows(null)
    }
  }

  async function submit() {
    if (!rows) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/users/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      })
      const body = (await res.json()) as ImportResponse
      setResults(body)
      if (body.created > 0) {
        notify("success", `นำเข้าสำเร็จ ${body.created} รายการ`)
        onImported()
      }
      if (body.failed > 0) notify("error", `มี ${body.failed} แถวที่ไม่สำเร็จ`)
    } catch {
      notify("error", "นำเข้าไม่สำเร็จ")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 font-thai">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">นำเข้าผู้ใช้จาก Excel</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="ปิด">
            <FaTimes />
          </button>
        </div>

        <button
          onClick={downloadTemplate}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <FaDownload className="h-3.5 w-3.5" /> ดาวน์โหลดเทมเพลต
        </button>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-10 text-center hover:border-blue-300">
          <FaFileExcel className="h-8 w-8 text-green-600" />
          <span className="text-sm text-slate-600">
            {fileName || "เลือกไฟล์ .xlsx ตามเทมเพลต"}
          </span>
          <input type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" />
        </label>

        {rows && !results && (
          <p className="mt-3 text-sm text-slate-500">พบ {rows.length} แถวในไฟล์</p>
        )}

        {results && (
          <div className="mt-4">
            <p className="text-sm">
              <span className="font-medium text-green-700">สำเร็จ {results.created}</span>
              {" · "}
              <span className="font-medium text-red-600">ไม่สำเร็จ {results.failed}</span>
            </p>
            {results.failed > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-red-100 bg-red-50 p-3 text-sm">
                {results.results
                  .filter((r) => r.status === "error")
                  .map((r) => (
                    <div key={r.row} className="py-0.5 text-red-700">
                      แถว {r.row} {r.email && `(${r.email})`}: {Object.values(r.errors ?? {}).join(", ")}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-100"
          >
            ปิด
          </button>
          <button
            onClick={submit}
            disabled={!rows || submitting}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {submitting ? "กำลังนำเข้า..." : "นำเข้า"}
          </button>
        </div>
      </div>
    </div>
  )
}
