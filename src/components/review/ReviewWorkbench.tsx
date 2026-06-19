"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { python } from "@codemirror/lang-python"
import { FaClock, FaCheck } from "react-icons/fa"
import type { ProblemListItem } from "@/lib/problems/repository"
import type { SubmissionListItem, SubmissionRecord } from "@/lib/submissions/repository"
import type { TestResult } from "@/types"

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false })

interface Props {
  problems: ProblemListItem[]
  courseSlug: string
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase()
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ReviewWorkbench({ problems, courseSlug }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const pid = Number.parseInt(searchParams.get("pid") ?? "", 10) || null
  const sid = Number.parseInt(searchParams.get("sid") ?? "", 10) || null

  const [queueItems, setQueueItems] = useState<SubmissionListItem[]>([])
  const [detail, setDetail] = useState<SubmissionRecord | null>(null)
  const [bonus, setBonus] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loadingQueue, setLoadingQueue] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const activeProblem = problems.find((p) => p.id === pid) ?? null
  const selectedItem = queueItems.find((s) => s.id === sid) ?? null

  const fetchQueue = useCallback(
    (problemId: number) => {
      setLoadingQueue(true)
      setQueueItems([])
      fetch(`/api/courses/${courseSlug}/problems/${problemId}/submissions`)
        .then((r) => r.json())
        .then(({ submissions }) => setQueueItems(submissions ?? []))
        .catch(() => {})
        .finally(() => setLoadingQueue(false))
    },
    [courseSlug]
  )

  useEffect(() => {
    if (!pid) return
    setDetail(null)
    fetchQueue(pid)
  }, [pid, fetchQueue])

  useEffect(() => {
    if (!pid || !sid) {
      setDetail(null)
      setBonus(0)
      return
    }
    setLoadingDetail(true)
    fetch(`/api/courses/${courseSlug}/problems/${pid}/submissions/${sid}`)
      .then((r) => r.json())
      .then(({ submission }: { submission: SubmissionRecord }) => {
        setDetail(submission ?? null)
        if (submission) {
          const auto = submission.pointsEarned ?? 0
          const effective = submission.manualScore ?? auto
          setBonus(effective - auto)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false))
  }, [courseSlug, pid, sid])

  function selectProblem(newPid: number) {
    router.push(`?pid=${newPid}`)
  }

  function selectSubmission(newSid: number) {
    router.push(`?pid=${pid}&sid=${newSid}`)
  }

  async function handleSave() {
    if (!pid || !sid || !detail) return
    setSaving(true)
    const auto = detail.pointsEarned ?? 0
    const manualScore = auto + bonus
    try {
      const res = await fetch(`/api/courses/${courseSlug}/problems/${pid}/submissions/${sid}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manualScore }),
      })
      if (res.ok) {
        const { submission } = await res.json()
        setDetail(submission)
        fetchQueue(pid)
      }
    } finally {
      setSaving(false)
    }
  }

  const auto = detail?.pointsEarned ?? 0
  const pointsMax = detail?.pointsMax ?? 0
  const bonusMax = Math.max(0, pointsMax - auto)
  const total = auto + bonus
  const results = (detail?.results ?? []) as TestResult[]
  const alreadyReviewed = !!detail?.reviewedAt

  return (
    <div className="flex flex-col gap-4 font-thai">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">ตรวจงาน</h1>
          {activeProblem && (
            <p className="mt-0.5 text-sm text-slate-500">
              สัปดาห์ {activeProblem.weekNo} ข้อ {activeProblem.problemNo} · {activeProblem.title}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">เลือกโจทย์</span>
          <select
            value={pid ?? ""}
            onChange={(e) => selectProblem(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {problems.map((p) => (
              <option key={p.id} value={p.id}>
                สัปดาห์ {p.weekNo} ข้อ {p.problemNo}. {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "260px 1fr 300px" }}>
        {/* LEFT: Queue */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-medium text-slate-600">รายการส่งงาน</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {queueItems.length}
            </span>
          </div>
          {loadingQueue ? (
            <div className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</div>
          ) : queueItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">ยังไม่มีการส่งงาน</div>
          ) : (
            <div className="flex flex-col overflow-y-auto">
              {queueItems.map((s) => {
                const active = s.id === sid
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectSubmission(s.id)}
                    className={`flex items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                      active ? "border-blue-500 bg-blue-50" : "border-transparent"
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
                      {initial(s.studentName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{s.studentName}</p>
                      <p className="font-mono text-xs text-slate-400">{s.studentIdCode ?? "–"}</p>
                    </div>
                    <div className="shrink-0">
                      {s.reviewedAt ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          ตรวจแล้ว
                        </span>
                      ) : (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                          รอตรวจ
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* CENTER: Code + Results */}
        <div className="flex min-w-0 flex-col gap-4">
          {!sid || (!detail && !loadingDetail) ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white py-24 text-sm text-slate-400">
              เลือกนักศึกษาจากรายการด้านซ้าย
            </div>
          ) : loadingDetail ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white py-24 text-sm text-slate-400">
              กำลังโหลด...
            </div>
          ) : (
            <>
              {/* Code viewer */}
              <div className="overflow-hidden rounded-xl border border-gray-700 bg-[#1e1e2e]">
                <div className="flex items-center justify-between border-b border-gray-700/60 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="h-3 w-3 rounded-full bg-yellow-500" />
                    <span className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="ml-2 font-mono text-sm text-slate-400">solution.py</span>
                  </div>
                  <span className="text-xs text-slate-500">Python · read-only</span>
                </div>
                <CodeMirror
                  value={detail?.code ?? ""}
                  theme="dark"
                  extensions={[python()]}
                  editable={false}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: false,
                    dropCursor: false,
                    allowMultipleSelections: false,
                  }}
                />
              </div>

              {/* Test results */}
              {results.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-700">ผลการตรวจอัตโนมัติ</h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        results.every((r) => r.passed)
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      ผ่าน {results.filter((r) => r.passed).length}/{results.length} เคส
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {results.map((r, i) => (
                      <div
                        key={r.testCaseId}
                        className={`flex items-start justify-between rounded-lg border p-3 ${
                          r.passed
                            ? "border-green-200 bg-green-50"
                            : "border-red-200 bg-red-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                              r.passed ? "bg-green-500" : "bg-red-500"
                            }`}
                          >
                            {r.passed ? "✓" : "✗"}
                          </div>
                          <div className="text-sm">
                            <p className={`font-medium ${r.passed ? "text-green-700" : "text-red-700"}`}>
                              Test Case #{i + 1}
                            </p>
                            {!r.passed && (
                              <div className="mt-1 space-y-0.5 font-mono text-xs text-slate-500">
                                <p>คาดหวัง: {r.expectedOutput || "(ว่าง)"}</p>
                                <p>ได้: {r.actualOutput || "(ว่าง)"}</p>
                                {r.error && <p className="text-red-500">Error: {r.error}</p>}
                              </div>
                            )}
                          </div>
                        </div>
                        {r.executionTime > 0 && (
                          <span className="shrink-0 text-xs text-slate-400">{r.executionTime} ms</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT: Grading panel */}
        <div className={`flex flex-col gap-4 ${!detail ? "pointer-events-none opacity-40" : ""}`}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            {/* Student info */}
            {selectedItem && (
              <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-base font-bold text-white">
                  {initial(selectedItem.studentName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{selectedItem.studentName}</p>
                  <p className="font-mono text-xs text-slate-400">{selectedItem.studentIdCode ?? "–"}</p>
                </div>
                {alreadyReviewed ? (
                  <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    ตรวจแล้ว
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                    รอตรวจ
                  </span>
                )}
              </div>
            )}

            {/* Meta */}
            {detail && (
              <div className="mb-4 flex flex-col gap-1.5 border-b border-gray-100 pb-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <FaClock className="h-3 w-3" />
                  ส่ง {fmt(detail.submittedAt)}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-slate-400">{"<>"}</span>
                  {detail.language}
                  {detail.isLate && (
                    <span className="ml-1 rounded-full bg-yellow-100 px-1.5 py-0.5 text-yellow-700">
                      ส่งช้า
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Auto score */}
            <div className="mb-4 border-b border-gray-100 pb-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-slate-500">คะแนนอัตโนมัติ</span>
                <span className="text-xl font-bold text-blue-600">
                  {auto}
                  <span className="text-sm font-normal text-slate-400">/{pointsMax}</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${pointsMax > 0 ? (auto / pointsMax) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Bonus stepper */}
            <div className="mb-4 border-b border-gray-100 pb-4">
              <p className="mb-2 text-sm text-slate-500">คะแนนพิเศษจากอาจารย์</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBonus((b) => Math.max(0, b - 1))}
                  disabled={bonus <= 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={bonusMax}
                  value={bonus}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(bonusMax, Number(e.target.value) || 0))
                    setBonus(v)
                  }}
                  className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setBonus((b) => Math.min(bonusMax, b + 1))}
                  disabled={bonus >= bonusMax}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  +
                </button>
                {bonusMax === 0 && (
                  <span className="text-xs text-slate-400">full marks</span>
                )}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-600">คะแนนรวม</span>
              <span className="text-2xl font-bold text-primary">
                {total}
                <span className="ml-1 text-sm font-normal text-slate-400">คะแนน</span>
              </span>
            </div>
          </div>

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !detail}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            <FaCheck className="h-4 w-4" />
            {saving ? "กำลังบันทึก..." : alreadyReviewed ? "บันทึกการแก้ไข" : "บันทึกผลการตรวจ"}
          </button>
        </div>
      </div>
    </div>
  )
}
