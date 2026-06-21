"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  FaArrowLeft,
  FaPlus,
  FaTrash,
  FaEyeSlash,
  FaEye,
  FaSave,
} from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import { SolutionEditor } from "@/components/editor/SolutionEditor"

interface TestCaseForm {
  id?: number
  input: string
  expectedOutput: string
  isHidden: boolean
  sortOrder: number
}

interface WeekOption {
  id: number
  weekNo: number
  topic: string
}

interface Props {
  courseSlug: string
  coursePath: string
  weeks: WeekOption[]
  mode: "create" | "edit"
  initialWeekId?: number
  referenceSolution?: string
  problem?: {
    id: number
    title: string
    description: string
    inputSpec: string
    outputSpec: string
    score: number
    dueAt: string | null
    closeAt: string | null
    language: string
    weekId: number
    testCases: TestCaseForm[]
  }
}

function emptyCase(sortOrder: number): TestCaseForm {
  return { input: "", expectedOutput: "", isHidden: false, sortOrder }
}

export function ProblemEditor({ courseSlug, coursePath, weeks, mode, initialWeekId, referenceSolution: initialRefSolution, problem }: Props) {
  const router = useRouter()
  const { notify } = useToast()

  const defaultWeekId = problem?.weekId ?? initialWeekId ?? weeks[0]?.id
  const [title, setTitle] = useState(problem?.title ?? "")
  const [description, setDescription] = useState(problem?.description ?? "")
  const [inputSpec, setInputSpec] = useState(problem?.inputSpec ?? "")
  const [outputSpec, setOutputSpec] = useState(problem?.outputSpec ?? "")
  const [weekId] = useState(defaultWeekId)
  const [score, setScore] = useState(problem?.score ?? 10)
  const [dueAt, setDueAt] = useState(problem?.dueAt ? toDatetimeLocal(problem.dueAt) : "")
  const [closeAt, setCloseAt] = useState(problem?.closeAt ? toDatetimeLocal(problem.closeAt) : "")
  const [language, setLanguage] = useState(problem?.language ?? "python")
  const [cases, setCases] = useState<TestCaseForm[]>(
    problem?.testCases.length
      ? problem.testCases
      : [emptyCase(0)]
  )
  const [refSolution, setRefSolution] = useState(initialRefSolution ?? "")
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [descTab, setDescTab] = useState<"write" | "preview">("write")

  const activeWeek = weeks.find((w) => w.id === weekId)

  function addCase() {
    setCases((prev) => [...prev, emptyCase(prev.length)])
  }

  function removeCase(idx: number) {
    setCases((prev) => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, sortOrder: i })))
  }

  function updateCase(idx: number, patch: Partial<TestCaseForm>) {
    setCases((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setSaving(true)

    const payload = {
      title: title.trim(),
      weekId,
      score: Number(score) || 10,
      description: description.trim(),
      inputSpec: inputSpec.trim(),
      outputSpec: outputSpec.trim(),
      dueAt: dueAt ? toISO(dueAt) : null,
      closeAt: closeAt ? toISO(closeAt) : null,
      language,
      referenceSolution: refSolution,
      testCases: cases.map((c, i) => ({
        input: c.input,
        expectedOutput: c.expectedOutput,
        isHidden: c.isHidden,
        sortOrder: i,
      })),
    }

    const url =
      mode === "create"
        ? `/api/courses/${courseSlug}/problems`
        : `/api/courses/${courseSlug}/problems/${problem!.id}`
    const method = mode === "create" ? "POST" : "PUT"

    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })

    setSaving(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      if (body.errors) setErrors(body.errors)
      else notify("error", "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
      return
    }

    notify("success", mode === "create" ? "สร้างโจทย์เรียบร้อยแล้ว" : "บันทึกโจทย์เรียบร้อยแล้ว")
    router.push(`${coursePath}/problems`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 font-thai">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`${coursePath}/problems`}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
        >
          <FaArrowLeft className="h-3 w-3" />
          กลับ
        </Link>
        <h1 className="text-2xl font-semibold text-primary">
          {mode === "create" ? "สร้างโจทย์ใหม่" : "แก้ไขโจทย์"}
        </h1>
      </div>

      {/* Two-column grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          {/* Problem info card */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-700">ข้อมูลโจทย์</h2>
            <div className="flex flex-col gap-4">
              <Field label="ชื่อโจทย์ *" error={errors.title}>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น Hello World"
                  className="input-base w-full"
                />
              </Field>
              <Field label="คำอธิบายโจทย์">
                <div className="flex gap-1 mb-1.5">
                  {(["write", "preview"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDescTab(tab)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                        descTab === tab
                          ? "bg-primary text-white"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {tab === "write" ? "เขียน" : "ดูตัวอย่าง"}
                    </button>
                  ))}
                </div>
                {descTab === "write" ? (
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    placeholder="รองรับ Markdown — เช่น **ตัวหนา**, | ตาราง |, `code`"
                    className="input-base w-full resize-y font-mono text-sm"
                  />
                ) : (
                  <div className="min-h-[144px] rounded-lg border border-gray-200 bg-slate-50 px-4 py-3">
                    {description.trim() ? (
                      <MarkdownContent content={description} />
                    ) : (
                      <span className="text-sm text-slate-400">ยังไม่มีเนื้อหา</span>
                    )}
                  </div>
                )}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="รูปแบบ Input">
                  <textarea
                    value={inputSpec}
                    onChange={(e) => setInputSpec(e.target.value)}
                    rows={3}
                    placeholder="เช่น บรรทัดแรกเป็นจำนวนเต็ม n..."
                    className="input-base w-full resize-y"
                  />
                </Field>
                <Field label="รูปแบบ Output">
                  <textarea
                    value={outputSpec}
                    onChange={(e) => setOutputSpec(e.target.value)}
                    rows={3}
                    placeholder="เช่น พิมพ์ตัวเลขผลรวม..."
                    className="input-base w-full resize-y"
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Reference solution card */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-base font-semibold text-slate-700">เฉลยอ้างอิง</h2>
            <p className="mb-3 text-xs text-slate-400">
              เฉลยนี้จัดเก็บในระบบเพื่อใช้ตรวจสอบ test cases — นักศึกษาไม่สามารถเห็นได้
            </p>
            <SolutionEditor value={refSolution} onChange={setRefSolution} />
          </div>

          {/* Test cases card */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-700">Test Cases</h2>
              <button
                type="button"
                onClick={addCase}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-secondary transition hover:bg-blue-100"
              >
                <FaPlus className="h-3 w-3" />
                เพิ่ม Test Case
              </button>
            </div>

            {errors.testCases && (
              <p className="mb-3 text-xs text-red-500">{errors.testCases}</p>
            )}

            <div className="flex flex-col gap-3">
              {cases.map((tc, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-gray-200 bg-slate-50 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Test Case {idx + 1}
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={tc.isHidden}
                          onChange={(e) => updateCase(idx, { isHidden: e.target.checked })}
                          className="h-3.5 w-3.5"
                        />
                        {tc.isHidden ? (
                          <><FaEyeSlash className="h-3 w-3" /> ซ่อน</>
                        ) : (
                          <><FaEye className="h-3 w-3" /> แสดง</>
                        )}
                      </label>
                      {cases.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCase(idx)}
                          className="text-slate-300 transition hover:text-red-500"
                          title="ลบ test case นี้"
                        >
                          <FaTrash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Input</label>
                      <textarea
                        value={tc.input}
                        onChange={(e) => updateCase(idx, { input: e.target.value })}
                        rows={3}
                        className="input-base w-full resize-y font-mono text-xs"
                        placeholder="ว่างได้ถ้าไม่มี input"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Expected Output</label>
                      <textarea
                        value={tc.expectedOutput}
                        onChange={(e) => updateCase(idx, { expectedOutput: e.target.value })}
                        rows={3}
                        className="input-base w-full resize-y font-mono text-xs"
                        placeholder="ผลลัพธ์ที่คาดหวัง"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-700">ตั้งค่าโจทย์</h2>
            <div className="flex flex-col gap-4">
              <Field label="สัปดาห์">
                <div className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {activeWeek
                    ? `สัปดาห์ ${activeWeek.weekNo}${activeWeek.topic ? ` · ${activeWeek.topic}` : ""}`
                    : "–"}
                </div>
              </Field>
              <Field label="คะแนน *" error={errors.score}>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                    className="input-base w-24 text-right"
                  />
                  <span className="text-sm text-slate-400">คะแนน</span>
                </div>
              </Field>
              <Field label="ภาษา">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="input-base w-full"
                >
                  <option value="python">Python</option>
                </select>
              </Field>
              <Field label="กำหนดส่ง (due_at)" error={errors.dueAt}>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="input-base w-full"
                />
              </Field>
              <Field label="วันปิดรับ (close_at)" error={errors.closeAt}>
                <input
                  type="datetime-local"
                  value={closeAt}
                  onChange={(e) => setCloseAt(e.target.value)}
                  className="input-base w-full"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  หลังวันนี้ระบบจะไม่รับงานส่งอีก
                </p>
              </Field>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
          >
            <FaSave className="h-4 w-4" />
            {saving ? "กำลังบันทึก..." : mode === "create" ? "สร้างโจทย์" : "บันทึกการแก้ไข"}
          </button>
        </div>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function toDatetimeLocal(iso: string): string {
  return iso.slice(0, 16)
}

function toISO(local: string): string {
  return new Date(local).toISOString()
}
