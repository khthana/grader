"use client"

import { useRef, useState } from "react"
import { FaArrowDown, FaArrowUp, FaPlus, FaTrash } from "react-icons/fa"
import { moveRow } from "@/lib/syllabus/rows"

/**
 * Stable React keys for an editor's rows, so focus follows a row that moves.
 * Every change to the rows' order goes through the editor, which reports it here.
 */
export function useRowKeys(count: number) {
  const next = useRef(count)
  const [keys, setKeys] = useState(() => Array.from({ length: count }, (_, i) => i))
  return {
    keyAt: (i: number) => keys[i] ?? `extra-${i}`,
    added: () => {
      const key = next.current++
      setKeys((current) => [...current, key])
    },
    removed: (i: number) => setKeys((current) => current.filter((_, j) => j !== i)),
    moved: (i: number, step: -1 | 1) => setKeys((current) => moveRow(current, i, step)),
  }
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
