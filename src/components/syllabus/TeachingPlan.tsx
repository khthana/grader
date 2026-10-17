"use client"

import { canMovePlanEntry, nextPlanWeek, MAX_PLAN_WEEK, MIN_PLAN_WEEK, type PlanEntry } from "@/lib/syllabus/plan"
import { AddRowButton, RowControls, RowErrors, RowTable, useRowList, type RowListErrors } from "./rows"

const COLUMNS = [{ label: "สัปดาห์", className: "w-20" }, { label: "หัวข้อ" }, { label: "รายละเอียด" }]

/** The Teaching Plan as every viewer sees it — the whole plan, whatever Weeks are released (#100). */
export function TeachingPlanView({ plan }: { plan: PlanEntry[] }) {
  return (
    <RowTable columns={COLUMNS} rowCount={plan.length}>
      {plan.map((entry, i) => (
        <tr key={i} className="border-b border-gray-100 align-top last:border-0">
          <td className="py-2 pr-3 text-slate-700">{entry.weekNo}</td>
          <td className="py-2 pr-3 text-slate-700">{entry.topic}</td>
          <td className="whitespace-pre-line py-2 text-slate-500">{entry.detail}</td>
        </tr>
      ))}
    </RowTable>
  )
}

const blankEntry = (plan: PlanEntry[]): PlanEntry => ({ weekNo: nextPlanWeek(plan), topic: "", detail: "" })

/**
 * Edit the Teaching Plan rows. Errors are keyed `plan.<row>.<field>` by the
 * row order sent, which is this list's order. A row moves only within its week.
 */
export function TeachingPlanEditor({
  plan,
  errors,
  onChange,
}: {
  plan: PlanEntry[]
  errors: RowListErrors
  onChange: (plan: PlanEntry[]) => void
}) {
  const rows = useRowList({ list: "plan", rows: plan, onChange, canMove: canMovePlanEntry, blankRow: blankEntry, errors })

  return (
    <div className="flex flex-col gap-3">
      {rows.listError && <p className="text-xs text-red-600">{rows.listError}</p>}
      {plan.map((entry, i) => (
        <div key={rows.keyAt(i)} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-start gap-2">
            <input
              type="number"
              min={MIN_PLAN_WEEK}
              max={MAX_PLAN_WEEK}
              step={1}
              value={Number.isFinite(entry.weekNo) ? entry.weekNo : ""}
              onChange={(e) => rows.update(i, { weekNo: e.target.value === "" ? NaN : Number(e.target.value) })}
              aria-label="สัปดาห์"
              className="input-base w-20"
            />
            <input
              value={entry.topic}
              onChange={(e) => rows.update(i, { topic: e.target.value })}
              placeholder="หัวข้อ"
              aria-label="หัวข้อ"
              className="input-base min-w-48 flex-1"
            />
            <input
              value={entry.detail}
              onChange={(e) => rows.update(i, { detail: e.target.value })}
              placeholder="รายละเอียด (ไม่บังคับ)"
              aria-label="รายละเอียด"
              className="input-base min-w-48 flex-1"
            />
            <RowControls
              canUp={rows.canMove(i, -1)}
              canDown={rows.canMove(i, 1)}
              onUp={() => rows.move(i, -1)}
              onDown={() => rows.move(i, 1)}
              onRemove={() => rows.remove(i)}
              moveHint=" (ภายในสัปดาห์เดียวกัน)"
            />
          </div>
          <RowErrors messages={rows.rowErrors(i)} />
        </div>
      ))}
      <AddRowButton onClick={rows.add} />
      <p className="text-xs text-slate-400">แผนการสอนไม่ผูกกับ Week ของโจทย์ — ใส่สัปดาห์สอบได้ แถวจะเรียงตามสัปดาห์เมื่อบันทึก</p>
    </div>
  )
}
