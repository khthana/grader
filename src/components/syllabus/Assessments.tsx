"use client"

import { canMoveRow, moveRow, rowErrors } from "@/lib/syllabus/rows"
import { assessmentTotal, isComplete, MAX_WEIGHT, type AssessmentComponent } from "@/lib/syllabus/weights"
import { AddRowButton, RowControls, RowErrors, useRowKeys } from "./rows"

const percent = (n: number) => `${n.toLocaleString("th-TH", { maximumFractionDigits: 2 })}%`

/** Assessment Components as every viewer sees them, with the total — a statement only (#101). */
export function AssessmentsView({ assessments }: { assessments: AssessmentComponent[] }) {
  if (assessments.length === 0) return <p className="text-sm text-slate-400">–</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-slate-500">
            <th className="py-2 pr-3 font-medium">รายการ</th>
            <th className="w-24 py-2 pr-3 text-right font-medium">สัดส่วน</th>
            <th className="py-2 font-medium">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          {assessments.map((c, i) => (
            <tr key={i} className="border-b border-gray-100 align-top">
              <td className="py-2 pr-3 text-slate-700">{c.name}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{percent(c.weight)}</td>
              <td className="py-2 text-slate-500">{c.note}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-medium text-slate-700">
            <td className="py-2 pr-3">รวม</td>
            <td className="py-2 pr-3 text-right tabular-nums">{percent(assessmentTotal(assessments))}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/**
 * Edit the Assessment Components. A total other than 100% is a warning, never
 * a block — the manager may fill it in gradually or state bonus marks.
 */
export function AssessmentsEditor({
  assessments,
  errors,
  onChange,
  onRowsMoved,
}: {
  assessments: AssessmentComponent[]
  errors: Record<string, string>
  onChange: (assessments: AssessmentComponent[]) => void
  /** Rows moved or were removed — row-keyed errors no longer point at the right row. */
  onRowsMoved: () => void
}) {
  const keys = useRowKeys(assessments.length)
  const total = assessmentTotal(assessments)
  const update = (i: number, patch: Partial<AssessmentComponent>) =>
    onChange(assessments.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const move = (i: number, step: -1 | 1) => {
    if (!canMoveRow(assessments, i, step)) return
    onChange(moveRow(assessments, i, step))
    keys.moved(i, step)
    onRowsMoved()
  }
  const remove = (i: number) => {
    onChange(assessments.filter((_, j) => j !== i))
    keys.removed(i)
    onRowsMoved()
  }
  const add = () => {
    onChange([...assessments, { name: "", weight: 0, note: "" }])
    keys.added()
  }

  return (
    <div className="flex flex-col gap-3">
      {errors.assessments && <p className="text-xs text-red-600">{errors.assessments}</p>}
      {assessments.map((c, i) => (
        <div key={keys.keyAt(i)} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-start gap-2">
            <input
              value={c.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="เช่น สอบกลางภาค"
              aria-label="รายการ"
              className="input-base min-w-48 flex-1"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={MAX_WEIGHT}
                step={0.01}
                value={Number.isFinite(c.weight) ? c.weight : ""}
                onChange={(e) => update(i, { weight: e.target.value === "" ? NaN : Number(e.target.value) })}
                aria-label="สัดส่วน (%)"
                className="input-base w-24 text-right"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
            <input
              value={c.note}
              onChange={(e) => update(i, { note: e.target.value })}
              placeholder="หมายเหตุ (ไม่บังคับ)"
              aria-label="หมายเหตุ"
              className="input-base min-w-48 flex-1"
            />
            <RowControls
              canUp={canMoveRow(assessments, i, -1)}
              canDown={canMoveRow(assessments, i, 1)}
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
              onRemove={() => remove(i)}
            />
          </div>
          <RowErrors messages={rowErrors(errors, "assessments", i)} />
        </div>
      ))}
      <AddRowButton onClick={add} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium text-slate-700">รวม {percent(total)}</span>
        {assessments.length > 0 && !isComplete(total) && (
          <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
            ยอดรวมยังไม่เท่ากับ 100% — บันทึกได้ตามปกติ
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400">เกณฑ์นี้แสดงให้นักศึกษาทราบเท่านั้น สมุดคะแนนไม่ได้คำนวณคะแนนตามสัดส่วนนี้</p>
    </div>
  )
}
