"use client"

import { useRef, useState } from "react"
import { FaArrowDown, FaArrowUp, FaPlus, FaTrash } from "react-icons/fa"
import {
  canMovePlanEntry,
  movePlanEntry,
  nextPlanWeek,
  planRowErrors,
  MAX_PLAN_WEEK, MIN_PLAN_WEEK, type PlanEntry } from "@/lib/syllabus/plan"

/** The Teaching Plan as every viewer sees it — the whole plan, whatever Weeks are released (#100). */
export function TeachingPlanView({ plan }: { plan: PlanEntry[] }) {
  if (plan.length === 0) return <p className="text-sm text-slate-400">–</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-slate-500">
            <th className="w-20 py-2 pr-3 font-medium">สัปดาห์</th>
            <th className="py-2 pr-3 font-medium">หัวข้อ</th>
            <th className="py-2 font-medium">รายละเอียด</th>
          </tr>
        </thead>
        <tbody>
          {plan.map((entry, i) => (
            <tr key={i} className="border-b border-gray-100 align-top last:border-0">
              <td className="py-2 pr-3 text-slate-700">{entry.weekNo}</td>
              <td className="py-2 pr-3 text-slate-700">{entry.topic}</td>
              <td className="whitespace-pre-line py-2 text-slate-500">{entry.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Edit the Teaching Plan rows. Errors are keyed `plan.<row>.<field>` by the
 * row order sent, which is this list's order.
 */
export function TeachingPlanEditor({
  plan,
  errors,
  onChange,
  onRowsMoved,
}: {
  plan: PlanEntry[]
  errors: Record<string, string>
  onChange: (plan: PlanEntry[]) => void
  /** Rows moved or were removed — row-keyed errors no longer point at the right row. */
  onRowsMoved: () => void
}) {
  // Stable row keys, so focus follows a row that moves. Every change to the
  // rows' order comes through this editor, so the ids move with them.
  const nextId = useRef(plan.length)
  const [ids, setIds] = useState(() => plan.map((_, i) => i))
  const update = (i: number, patch: Partial<PlanEntry>) =>
    onChange(plan.map((entry, j) => (j === i ? { ...entry, ...patch } : entry)))
  const move = (i: number, step: -1 | 1) => {
    onChange(movePlanEntry(plan, i, step))
    onRowsMoved()
    setIds((current) => movePlanEntry(current.map((id, j) => ({ id, weekNo: plan[j]?.weekNo })), i, step).map((r) => r.id))
  }
  const remove = (i: number) => {
    onChange(plan.filter((_, j) => j !== i))
    onRowsMoved()
    setIds((current) => current.filter((_, j) => j !== i))
  }
  const add = () => {
    onChange([...plan, { weekNo: nextPlanWeek(plan), topic: "", detail: "" }])
    setIds((current) => [...current, nextId.current++])
  }
  const arrow = "rounded p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"

  return (
    <div className="flex flex-col gap-3">
      {errors.plan && <p className="text-xs text-red-600">{errors.plan}</p>}
      {plan.map((entry, i) => {
        const rowErrors = planRowErrors(errors, i)
        return (
          <div key={ids[i] ?? `extra-${i}`} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-start gap-2">
              <input
                type="number"
                min={MIN_PLAN_WEEK}
                max={MAX_PLAN_WEEK}
                step={1}
                value={Number.isFinite(entry.weekNo) ? entry.weekNo : ""}
                onChange={(e) => update(i, { weekNo: e.target.value === "" ? NaN : Number(e.target.value) })}
                aria-label="สัปดาห์"
                className="input-base w-20"
              />
              <input
                value={entry.topic}
                onChange={(e) => update(i, { topic: e.target.value })}
                placeholder="หัวข้อ"
                aria-label="หัวข้อ"
                className="input-base min-w-48 flex-1"
              />
              <input
                value={entry.detail}
                onChange={(e) => update(i, { detail: e.target.value })}
                placeholder="รายละเอียด (ไม่บังคับ)"
                aria-label="รายละเอียด"
                className="input-base min-w-48 flex-1"
              />
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={!canMovePlanEntry(plan, i, -1)}
                  title="เลื่อนขึ้น (ภายในสัปดาห์เดียวกัน)"
                  className={arrow}
                >
                  <FaArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={!canMovePlanEntry(plan, i, 1)}
                  title="เลื่อนลง (ภายในสัปดาห์เดียวกัน)"
                  className={arrow}
                >
                  <FaArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  title="ลบแถว"
                  className="rounded p-1.5 text-red-500 transition hover:bg-red-50"
                >
                  <FaTrash className="h-3 w-3" />
                </button>
              </div>
            </div>
            {rowErrors.map((message) => (
              <p key={message} className="text-xs text-red-600">
                {message}
              </p>
            ))}
          </div>
        )
      })}
      <button
        type="button"
        onClick={add}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
      >
        <FaPlus className="h-3 w-3" />
        เพิ่มแถว
      </button>
      <p className="text-xs text-slate-400">แผนการสอนไม่ผูกกับ Week ของโจทย์ — ใส่สัปดาห์สอบได้ แถวจะเรียงตามสัปดาห์เมื่อบันทึก</p>
    </div>
  )
}
