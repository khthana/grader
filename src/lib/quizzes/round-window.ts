// Round Window (ADR 0011): when a Quiz Round accepts answers for one Group.
// The one definition of open/closed — derived from two instants and the clock,
// never a stored flag. Pure: `now` is injected.
//
// A window is half-open, [opensAt, closesAt): open from the open instant, closed
// from the close instant. So a Post can start exactly when its Pre closes.

export type QuizRound = "pre" | "post"
export const QUIZ_ROUNDS: readonly QuizRound[] = ["pre", "post"]

export const isQuizRound = (v: unknown): v is QuizRound => QUIZ_ROUNDS.includes(v as QuizRound)

export const QUIZ_ROUND_LABEL: Record<QuizRound, string> = { pre: "Pre-test", post: "Post-test" }

export type RoundWindowState = "not-open" | "open" | "closed"

export interface WindowTimes {
  opensAt: Date | null
  closesAt: Date | null
}

export function roundWindow({ opensAt, closesAt }: WindowTimes, now: Date): RoundWindowState {
  if (!opensAt || now < opensAt) return "not-open"
  if (closesAt && now >= closesAt) return "closed"
  return "open"
}

/** Do two windows share any instant? A window with no open instant has none. */
export function windowsOverlap(a: WindowTimes, b: WindowTimes): boolean {
  if (!a.opensAt || !b.opensAt) return false
  const aEnd = a.closesAt?.getTime() ?? Infinity
  const bEnd = b.closesAt?.getTime() ?? Infinity
  return a.opensAt.getTime() < bEnd && b.opensAt.getTime() < aEnd
}
