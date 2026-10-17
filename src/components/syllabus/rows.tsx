"use client"

import { useRef, useState, type ReactNode } from "react"
import { FaArrowDown, FaArrowUp, FaPlus, FaTrash } from "react-icons/fa"
import { canMoveRow, editRows, rowErrors, type Errors, type MoveRule, type RowEdit, type RowList } from "@/lib/syllabus/rows"

/** The panel's field errors travel with the way to drop one list's row errors once its rows move. */
export interface RowListErrors {
  fieldErrors: Errors
  clearRowErrors: (list: RowList) => void
}

/**
 * One Syllabus row list's editing (#105) — update / move / remove / add, the
 * rows' stable React keys (so focus follows a row that moves) and dropping the
 * list's row errors once rows change position. Each editor states only what
 * differs: its blank row and its move rule.
 */
export function useRowList<T>({
  list,
  rows,
  onChange,
  canMove,
  blankRow,
  errors,
}: {
  list: RowList
  rows: T[]
  onChange: (rows: T[]) => void
  canMove: MoveRule<T>
  /** The row "เพิ่มแถว" appends, given the rows so far. */
  blankRow: (rows: T[]) => T
  errors: RowListErrors
}) {
  const nextKey = useRef(rows.length)
  const [keys, setKeys] = useState(() => Array.from({ length: rows.length }, (_, i) => i))

  const apply = (edit: RowEdit<T>) => {
    const result = editRows(rows, edit, canMove)
    if (!result) return
    onChange(result.rows)
    if (edit.kind !== "update") {
      // The keys follow the rows: the same edit, a fresh key for an added row.
      // The list's own rule already allowed a move, so the keys only need the bounds.
      const keyEdit: RowEdit<number> = edit.kind === "add" ? { kind: "add", row: nextKey.current++ } : edit
      setKeys((current) => editRows(current, keyEdit, canMoveRow)?.rows ?? current)
    }
    if (result.reordered) errors.clearRowErrors(list)
  }

  return {
    keyAt: (i: number) => keys[i] ?? `extra-${i}`,
    canMove: (i: number, step: -1 | 1) => canMove(rows, i, step),
    update: (i: number, patch: Partial<T>) => apply({ kind: "update", index: i, patch }),
    move: (i: number, step: -1 | 1) => apply({ kind: "move", index: i, step }),
    remove: (i: number) => apply({ kind: "remove", index: i }),
    add: () => apply({ kind: "add", row: blankRow(rows) }),
    /** The list's own error (e.g. not a list at all). */
    listError: errors.fieldErrors[list] as string | undefined,
    rowErrors: (i: number) => rowErrors(errors.fieldErrors, list, i),
  }
}

/** A read-only row list as every viewer sees it — "–" when there are no rows. */
export function RowTable({
  columns,
  rowCount,
  children,
  footer,
}: {
  columns: { label: string; className?: string }[]
  rowCount: number
  children: ReactNode
  footer?: ReactNode
}) {
  if (rowCount === 0) return <p className="text-sm text-slate-400">–</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-slate-500">
            {columns.map((c, i) => (
              <th key={c.label} className={[c.className, "py-2", i < columns.length - 1 && "pr-3", "font-medium"].filter(Boolean).join(" ")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  )
}

const iconButton = "rounded p-1.5 transition disabled:opacity-30 disabled:hover:bg-transparent"

/** A row's ↑ / ↓ / delete buttons. */
export function RowControls({
  canUp,
  canDown,
  onUp,
  onDown,
  onRemove,
  moveHint = "",
}: {
  canUp: boolean
  canDown: boolean
  onUp: () => void
  onDown: () => void
  onRemove: () => void
  moveHint?: string
}) {
  return (
    <div className="flex items-center">
      <button type="button" onClick={onUp} disabled={!canUp} title={`เลื่อนขึ้น${moveHint}`} className={`${iconButton} text-slate-500 hover:bg-slate-100`}>
        <FaArrowUp className="h-3 w-3" />
      </button>
      <button type="button" onClick={onDown} disabled={!canDown} title={`เลื่อนลง${moveHint}`} className={`${iconButton} text-slate-500 hover:bg-slate-100`}>
        <FaArrowDown className="h-3 w-3" />
      </button>
      <button type="button" onClick={onRemove} title="ลบแถว" className={`${iconButton} text-red-500 hover:bg-red-50`}>
        <FaTrash className="h-3 w-3" />
      </button>
    </div>
  )
}

export function AddRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
    >
      <FaPlus className="h-3 w-3" />
      เพิ่มแถว
    </button>
  )
}

export function RowErrors({ messages }: { messages: string[] }) {
  return messages.map((message) => (
    <p key={message} className="text-xs text-red-600">
      {message}
    </p>
  ))
}
