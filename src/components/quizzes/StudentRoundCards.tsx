import Link from "next/link"
import { QUIZ_ROUNDS, QUIZ_ROUND_LABEL, type QuizRound } from "@/lib/quizzes/round-window"
import type { StudentRoundSummary } from "@/lib/quizzes/result-view"
import { RoundStateBadge } from "./RoundStateBadge"

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : null

function actionLabel(r: StudentRoundSummary): string | null {
  if (r.attempt?.submitted) return "ดูผล"
  if (r.state === "open") return r.attempt ? "ทำต่อ" : "เริ่มทำ"
  return null
}

/** A Student's Pre and Post rounds of one Quiz: window, their status and score. */
export function StudentRoundCards({
  rounds,
  quizPath,
}: {
  rounds: Record<QuizRound, StudentRoundSummary>
  quizPath: string
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {QUIZ_ROUNDS.map((round) => {
        const r = rounds[round]
        const action = actionLabel(r)
        return (
          <div key={round} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-700">{QUIZ_ROUND_LABEL[round]}</span>
              <RoundStateBadge state={r.state} />
            </div>
            <p className="text-xs text-slate-500">
              {when(r.opensAt) ? `เปิด ${when(r.opensAt)}` : "ยังไม่กำหนดเวลาเปิด"}
              {when(r.closesAt) && ` · ปิด ${when(r.closesAt)}`}
            </p>
            <p className="text-sm text-slate-600">
              {r.attempt?.submitted
                ? `ส่งแล้ว · ${r.attempt.score}/${r.attempt.max} คะแนน`
                : r.attempt
                  ? "กำลังทำ (ยังไม่ส่ง)"
                  : r.state === "closed"
                    ? "ไม่ได้ทำ"
                    : "ยังไม่ได้ทำ"}
            </p>
            {action && (
              <Link
                href={`${quizPath}/${round}`}
                className="mt-1 w-fit rounded-lg bg-primary px-4 py-1.5 text-sm text-white transition hover:bg-primary-hover"
              >
                {action}
              </Link>
            )}
          </div>
        )
      })}
    </div>
  )
}
