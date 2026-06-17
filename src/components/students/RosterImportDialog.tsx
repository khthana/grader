"use client"

import { useState } from "react"
import * as XLSX from "xlsx"
import { FaTimes, FaFileExcel } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"
import { parseKmitlSheet } from "@/lib/import/kmitl"

interface RowResult {
  row: number
  status: "created" | "enrolled" | "skipped" | "error"
  idCode: string
  errors?: Record<string, string>
}

interface ImportResponse {
  results: RowResult[]
  created: number
  enrolled: number
  skipped: number
  failed: number
}

interface Props {
  courseId: number
  onClose: () => void
  onImported: () => void
}

export function RosterImportDialog({ courseId, onClose, onImported }: Props) {
  const { notify } = useToast()
  const [rows, setRows] = useState<Record<string, string>[] | null>(null)
  const [fileName, setFileName] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [results, setResults] = useState<ImportResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function readFile(file: File) {
    setFileName(file.name)
    setResults(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        blankrows: false,
        defval: "",
      })
      // Each student is enrolled into this course; ตอน becomes the study group,
      // and the login email is derived ({รหัส}@kmitl.ac.th) server-side.
      const mapped = parseKmitlSheet(aoa).map((s) => ({
        idCode: s.idCode,
        titleTh: s.titleTh,
        firstNameTh: s.firstNameTh,
        lastNameTh: s.lastNameTh,
        studyGroup: s.studyGroup,
      }))
      if (mapped.length === 0) {
        notify("error", "ไม่พบรายชื่อนักศึกษาในไฟล์ (รองรับไฟล์ใบคะแนนสอบ สจล.)")
        setRows(null)
        return
      }
      setRows(mapped)
    } catch {
      notify("error", "อ่านไฟล์ Excel ไม่สำเร็จ")
      setRows(null)
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await readFile(file)
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await readFile(file)
  }

  async function submit() {
    if (!rows) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/courses/${courseId}/students/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      })
      const body = (await res.json()) as ImportResponse
      setResults(body)
      const added = body.created + body.enrolled
      if (added > 0) {
        notify("success", `นำเข้าสำเร็จ ${added} รายชื่อ`)
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
          <h2 className="text-xl font-semibold text-primary">นำเข้านักศึกษาจาก Excel</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="ปิด">
            <FaTimes />
          </button>
        </div>

        <p className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
          รองรับไฟล์ <span className="font-medium text-slate-600">ใบคะแนนสอบ (.xls)</span> จากสำนักทะเบียน สจล.
          นักศึกษาทุกคนในไฟล์จะถูกเพิ่มเข้าวิชานี้ โดยใช้ <span className="font-medium text-slate-600">ตอน</span> เป็นกลุ่มเรียน
        </p>

        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 text-center transition ${
            rows
              ? "border-green-300 bg-green-50"
              : dragOver
                ? "border-blue-400 bg-blue-50"
                : "border-slate-200 bg-slate-50 hover:border-blue-300"
          }`}
        >
          <FaFileExcel className={`h-8 w-8 ${rows ? "text-green-600" : "text-slate-400"}`} />
          <span className="text-sm text-slate-600">
            {fileName
              ? `${fileName}${rows ? ` · พบ ${rows.length} รายชื่อ พร้อมนำเข้า` : ""}`
              : "ลากไฟล์ใบคะแนนสอบมาวาง หรือคลิกเพื่อเลือก"}
          </span>
          <span className="text-xs text-slate-400">ไฟล์ใบคะแนนสอบ (.xls / .xlsx) จากสำนักทะเบียน สจล.</span>
          <input type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" />
        </label>

        {rows && !results && rows.length > 0 && (
          <div className="mt-4 max-h-56 overflow-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">รหัส</th>
                  <th className="px-3 py-2 text-left font-medium">คำนำหน้า</th>
                  <th className="px-3 py-2 text-left font-medium">ชื่อ</th>
                  <th className="px-3 py-2 text-left font-medium">นามสกุล</th>
                  <th className="px-3 py-2 text-left font-medium">กลุ่ม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 font-mono text-slate-600">{r.idCode}</td>
                    <td className="px-3 py-1.5 text-slate-600">{r.titleTh}</td>
                    <td className="px-3 py-1.5 text-slate-800">{r.firstNameTh}</td>
                    <td className="px-3 py-1.5 text-slate-800">{r.lastNameTh}</td>
                    <td className="px-3 py-1.5 text-slate-600">{r.studyGroup}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {results && (
          <div className="mt-4">
            <p className="text-sm">
              <span className="font-medium text-green-700">
                สำเร็จ {results.created + results.enrolled}
              </span>
              {" · "}
              <span className="font-medium text-amber-600">ข้าม {results.skipped}</span>
              {" · "}
              <span className="font-medium text-red-600">ไม่สำเร็จ {results.failed}</span>
            </p>
            {results.failed > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-red-100 bg-red-50 p-3 text-sm">
                {results.results
                  .filter((r) => r.status === "error")
                  .map((r) => (
                    <div key={r.row} className="py-0.5 text-red-700">
                      แถว {r.row} {r.idCode && `(${r.idCode})`}: {Object.values(r.errors ?? {}).join(", ")}
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
            {submitting ? "กำลังนำเข้า..." : `นำเข้า${rows ? ` (${rows.length} รายชื่อ)` : ""}`}
          </button>
        </div>
      </div>
    </div>
  )
}
