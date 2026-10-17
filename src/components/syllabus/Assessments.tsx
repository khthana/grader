"use client"

import { canMoveRow } from "@/lib/syllabus/rows"
import { assessmentTotal, isComplete, MAX_WEIGHT, type AssessmentComponent } from "@/lib/syllabus/weights"
import { AddRowButton, RowControls, RowErrors, RowTable, useRowList, type RowListErrors } from "./rows"

const percent = (n: number) => `${n.toLocaleString("th-TH", { maximumFractionDigits: 2 })}%`

const COLUMNS = [{ label: "รายการ" }, { label: "สัดส่วน", className: "w-24 text-right" }, { label: "หมายเหตุ" }]

/** Assessment Components as every viewer sees them, with the total — a statement only (#101). */
export function AssessmentsView({ assessments }: { assessments: AssessmentComponent[] }) {
  return (
    <RowTable
      columns={COLUMNS}
      rowCount={assessments.length}
      footer={
        <tr className="font-medium text-slate-700">
          <td className="py-2 pr-3">รวม</td>
          <td className="py-2 pr-3 text-right tabular-nums">{percent(assessmentTotal(assessments))}</td>
          <td />
        </tr>
      }
    >
      {assessments.map((c, i) => (
        <tr key={i} className="border-b border-gray-100 align-top">
          <td className="py-2 pr-3 text-slate-700">{c.name}</td>
          <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{percent(c.weight)}</td>
          <td className="py-2 text-slate-500">{c.note}</td>
        </tr>
      ))}
    </RowTable>
  )
}

const blankComponent = (): AssessmentComponent => ({ name: "", weight: 0, note: "" })

/**
 * Edit the Assessment Components. A total other than 100% is a warning, never
 * a block — the manager may fill it in gradually or state bonus marks. A row
 * moves past any neighbour.
 */
export function AssessmentsEditor({
  assessments,
  errors,
  onChange,
}: {
  assessments: AssessmentComponent[]
  errors: RowListErrors
  onChange: (assessments: AssessmentComponent[]) => void
}) {
  const rows = useRowList({ list: "assessments", rows: assessments, onChange, canMove: canMoveRow, blankRow: blankComponent, errors })
  const total = assessmentTotal(assessments)

  return (
    <div className="flex flex-col gap-3">
      {rows.listError && <p className="text-xs text-red-600">{rows.listError}</p>}
      {assessments.map((c, i) => (
        <div key={rows.keyAt(i)} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-start gap-2">
            <input
              value={c.name}
              onChange={(e) => rows.update(i, { name: e.target.value })}
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
                onChange={(e) => rows.update(i, { weight: e.target.value === "" ? NaN : Number(e.target.value) })}
                aria-label="สัดส่วน (%)"
                className="input-base w-24 text-right"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
            <input
              value={c.note}
              onChange={(e) => rows.update(i, { note: e.target.value })}
              placeholder="หมายเหตุ (ไม่บังคับ)"
              aria-label="หมายเหตุ"
              className="input-base min-w-48 flex-1"
            />
            <RowControls
              canUp={rows.canMove(i, -1)}
              canDown={rows.canMove(i, 1)}
              onUp={() => rows.move(i, -1)}
              onDown={() => rows.move(i, 1)}
              onRemove={() => rows.remove(i)}
            />
          </div>
          <RowErrors messages={rows.rowErrors(i)} />
        </div>
      ))}
      <AddRowButton onClick={rows.add} />
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
