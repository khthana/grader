"use client"

import { canMovePlanEntry, movePlanEntry, nextPlanWeek, MAX_PLAN_WEEK, MIN_PLAN_WEEK, type PlanEntry } from "@/lib/syllabus/plan"
import { rowErrors } from "@/lib/syllabus/rows"
import { AddRowButton, RowControls, RowErrors, useRowKeys } from "./rows"

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
  const keys = useRowKeys(plan.length)
  const update = (i: number, patch: Partial<PlanEntry>) =>
    onChange(plan.map((entry, j) => (j === i ? { ...entry, ...patch } : entry)))
  const move = (i: number, step: -1 | 1) => {
    if (!canMovePlanEntry(plan, i, step)) return
    onChange(movePlanEntry(plan, i, step))
    keys.moved(i, step)
    onRowsMoved()
  }
  const remove = (i: number) => {
    onChange(plan.filter((_, j) => j !== i))
    keys.removed(i)
    onRowsMoved()
  }
  const add = () => {
    onChange([...plan, { weekNo: nextPlanWeek(plan), topic: "", detail: "" }])
    keys.added()
  }

  return (
    <div className="flex flex-col gap-3">
      {errors.plan && <p className="text-xs text-red-600">{errors.plan}</p>}
      {plan.map((entry, i) => (
        <div key={keys.keyAt(i)} className="flex flex-col gap-1">
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
            <RowControls
              canUp={canMovePlanEntry(plan, i, -1)}
              canDown={canMovePlanEntry(plan, i, 1)}
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
              onRemove={() => remove(i)}
              moveHint=" (ภายในสัปดาห์เดียวกัน)"
            />
          </div>
          <RowErrors messages={rowErrors(errors, "plan", i)} />
        </div>
      ))}
      <AddRowButton onClick={add} />
      <p className="text-xs text-slate-400">แผนการสอนไม่ผูกกับ Week ของโจทย์ — ใส่สัปดาห์สอบได้ แถวจะเรียงตามสัปดาห์เมื่อบันทึก</p>
    </div>
  )
}
