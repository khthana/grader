import type { QuestionOutcome } from "@/lib/quizzes/attempt"

const OUTCOME: Record<QuestionOutcome, { label: string; className: string }> = {
  correct: { label: "ถูก", className: "bg-green-100 text-green-700" },
  wrong: { label: "ผิด", className: "bg-red-100 text-red-700" },
  "dont-know": { label: "ไม่ทราบ", className: "bg-amber-100 text-amber-700" },
  unanswered: { label: "ไม่ได้ตอบ", className: "bg-slate-100 text-slate-500" },
}

export function OutcomeBadge({ outcome, className = "" }: { outcome: QuestionOutcome; className?: string }) {
  const o = OUTCOME[outcome]
  return <span className={`rounded-full px-2 py-0.5 text-xs ${o.className} ${className}`}>{o.label}</span>
}
