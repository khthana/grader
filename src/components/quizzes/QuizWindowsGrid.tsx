"use client"

import { useCallback, useEffect, useState } from "react"
import { useToast } from "@/components/shell/ToastProvider"
import { QUIZ_ROUNDS, QUIZ_ROUND_LABEL, type QuizRound, type RoundWindowState } from "@/lib/quizzes/round-window"
import type { WindowGridRow, WindowSlot } from "@/lib/quizzes/windows"

const ROUNDS = QUIZ_ROUNDS.map((round) => ({ round, label: QUIZ_ROUND_LABEL[round] }))

const STATE_BADGE: Record<RoundWindowState, { label: string; className: string }> = {
  "not-open": { label: "ยังไม่เปิด", className: "bg-slate-100 text-slate-600" },
  open: { label: "เปิดอยู่", className: "bg-green-100 text-green-700" },
  closed: { label: "ปิดแล้ว", className: "bg-red-100 text-red-700" },
}

type Draft = { opensAt: string; closesAt: string }
type WindowChange = { round: QuizRound; groupKey: string; opensAt?: string | null; closesAt?: string | null }

/** ISO instant → the browser-local value a datetime-local input shows. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fromLocalInput = (local: string): string | null => (local ? new Date(local).toISOString() : null)

const draftKey = (round: QuizRound, groupKey: string) => `${round}:${groupKey}`

function draftsFrom(rows: WindowGridRow[]): Record<string, Draft> {
  const drafts: Record<string, Draft> = {}
  for (const row of rows) {
    for (const { round } of ROUNDS) {
      const slot = row.windows[round]
      drafts[draftKey(round, row.groupKey)] = {
        opensAt: toLocalInput(slot.opensAt),
        closesAt: toLocalInput(slot.closesAt),
      }
    }
  }
  return drafts
}

/** Round Windows per Group (#91): staff schedule or open/close each Quiz Round. */
export function QuizWindowsGrid({
  courseSlug,
  quizId,
  canManage,
}: {
  courseSlug: string
  quizId: number
  canManage: boolean
}) {
  const { notify } = useToast()
  const [rows, setRows] = useState<WindowGridRow[] | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [busy, setBusy] = useState(false)

  const api = `/api/courses/${courseSlug}/quizzes/${quizId}/windows`

  const applyGrid = useCallback((next: WindowGridRow[]) => {
    setRows(next)
    setDrafts(draftsFrom(next))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(api)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body) applyGrid(body.groups)
      })
    return () => {
      cancelled = true
    }
  }, [api, applyGrid])

  async function save(windows: WindowChange[], success: string) {
    setBusy(true)
    const res = await fetch(api, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windows }),
    })
    setBusy(false)
    const body = await res.json().catch(() => ({}))
    if (res.ok) {
      applyGrid(body.groups)
      notify("success", success)
    } else {
      notify("error", body.error ?? "บันทึกช่วงเวลาไม่สำเร็จ")
    }
  }

  function setDraft(round: QuizRound, groupKey: string, patch: Partial<Draft>) {
    const key = draftKey(round, groupKey)
    setDrafts((d) => ({ ...d, [key]: { ...d[key], ...patch } }))
  }

  function draftChange(round: QuizRound, groupKey: string): WindowChange {
    const d = drafts[draftKey(round, groupKey)]
    return { round, groupKey, opensAt: fromLocalInput(d.opensAt), closesAt: fromLocalInput(d.closesAt) }
  }

  if (!rows) return <p className="text-sm text-slate-400">กำลังโหลดช่วงเวลา...</p>

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-600">ช่วงเวลาทำแบบทดสอบ (แยกตามกลุ่ม)</h2>
      <p className="mt-1 text-xs text-slate-400">
        Pre-test และ Post-test ของกลุ่มเดียวกันต้องไม่ทับกัน · Post-test เริ่มได้ตั้งแต่เวลาที่ Pre-test ปิด
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-slate-500">
              <th className="py-2 pr-3 font-medium">กลุ่ม</th>
              {ROUNDS.map(({ round, label }) => (
                <th key={round} className="px-3 py-2 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.groupKey} className="border-b border-gray-100 align-top last:border-0">
                <td className="py-3 pr-3 font-medium text-slate-700">{row.label}</td>
                {ROUNDS.map(({ round, label }) => (
                  <td key={round} className="px-3 py-3">
                    <WindowCell
                      slot={row.windows[round]}
                      draft={drafts[draftKey(round, row.groupKey)]}
                      canManage={canManage}
                      busy={busy}
                      onDraft={(patch) => setDraft(round, row.groupKey, patch)}
                      onSave={() => save([draftChange(round, row.groupKey)], `บันทึก ${label} ${row.label} แล้ว`)}
                      onOpenNow={() =>
                        save([{ round, groupKey: row.groupKey, opensAt: "now" }], `เปิด ${label} ${row.label} แล้ว`)
                      }
                      onCloseNow={() =>
                        save([{ round, groupKey: row.groupKey, closesAt: "now" }], `ปิด ${label} ${row.label} แล้ว`)
                      }
                      onApplyAll={() => {
                        const { opensAt, closesAt } = draftChange(round, row.groupKey)
                        save(
                          rows.map((r) => ({ round, groupKey: r.groupKey, opensAt, closesAt })),
                          `ใช้ช่วงเวลา ${label} กับทุกกลุ่มแล้ว`
                        )
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WindowCell({
  slot,
  draft,
  canManage,
  busy,
  onDraft,
  onSave,
  onOpenNow,
  onCloseNow,
  onApplyAll,
}: {
  slot: WindowSlot
  draft: Draft
  canManage: boolean
  busy: boolean
  onDraft: (patch: Partial<Draft>) => void
  onSave: () => void
  onOpenNow: () => void
  onCloseNow: () => void
  onApplyAll: () => void
}) {
  const badge = STATE_BADGE[slot.state]
  const button =
    "rounded-md border border-gray-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
  return (
    <div className="flex flex-col gap-2">
      <span className={`w-fit rounded-full px-2 py-0.5 text-xs ${badge.className}`}>{badge.label}</span>
      {canManage ? (
        <>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-6">เปิด</span>
            <input
              type="datetime-local"
              value={draft.opensAt}
              onChange={(e) => onDraft({ opensAt: e.target.value })}
              className="rounded-md border border-gray-300 px-2 py-1 text-slate-700"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-6">ปิด</span>
            <input
              type="datetime-local"
              value={draft.closesAt}
              onChange={(e) => onDraft({ closesAt: e.target.value })}
              className="rounded-md border border-gray-300 px-2 py-1 text-slate-700"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={onSave} disabled={busy} className={button}>
              บันทึก
            </button>
            {/* A closed window reopens by saving a later close time. */}
            {slot.state === "not-open" && (
              <button onClick={onOpenNow} disabled={busy} className={button}>
                เปิดเดี๋ยวนี้
              </button>
            )}
            {slot.state === "open" && (
              <button onClick={onCloseNow} disabled={busy} className={button}>
                ปิดเดี๋ยวนี้
              </button>
            )}
            <button onClick={onApplyAll} disabled={busy} className={button}>
              ใช้กับทุกกลุ่ม
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500">
          เปิด: {slot.opensAt ? new Date(slot.opensAt).toLocaleString("th-TH") : "—"}
          <br />
          ปิด: {slot.closesAt ? new Date(slot.closesAt).toLocaleString("th-TH") : "—"}
        </p>
      )}
    </div>
  )
}
