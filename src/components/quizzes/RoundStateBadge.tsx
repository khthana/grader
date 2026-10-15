import type { RoundWindowState } from "@/lib/quizzes/round-window"

const STATE_BADGE: Record<RoundWindowState, { label: string; className: string }> = {
  "not-open": { label: "ยังไม่เปิด", className: "bg-slate-100 text-slate-600" },
  open: { label: "เปิดอยู่", className: "bg-green-100 text-green-700" },
  closed: { label: "ปิดแล้ว", className: "bg-red-100 text-red-700" },
}

export function RoundStateBadge({ state }: { state: RoundWindowState }) {
  const badge = STATE_BADGE[state]
  return <span className={`w-fit rounded-full px-2 py-0.5 text-xs ${badge.className}`}>{badge.label}</span>
}
