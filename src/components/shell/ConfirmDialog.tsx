"use client"

import { FaExclamationTriangle } from "react-icons/fa"

interface Props {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

export function ConfirmDialog({ title, message, confirmLabel = "ลบ", onConfirm, onCancel, busy }: Props) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 font-thai">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <FaExclamationTriangle className="text-2xl text-red-500" />
          <h2 className="text-xl font-semibold text-red-500">{title}</h2>
        </div>
        <p className="mt-4 text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-100"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "กำลังลบ..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
