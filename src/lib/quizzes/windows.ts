// Round Windows (#91, ADR 0011): per (Quiz Round × Group) open/close instants,
// the staff edit that changes them, and the grid staff see.
import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import { listGroups } from "@/lib/enrollments/repository"
import {
  QUIZ_ROUNDS,
  QUIZ_ROUND_LABEL,
  isQuizRound,
  roundWindow,
  windowsOverlap,
  type QuizRound,
  type RoundWindowState,
  type WindowTimes,
} from "./round-window"

/** The Group key for students with no Group — they share one window. */
export const NO_GROUP = ""

/** An Enrollment's study group as a window key — blank or missing = ไม่ระบุกลุ่ม. */
export const groupKeyOf = (studyGroup: string | null | undefined) => studyGroup?.trim() || NO_GROUP

export const groupLabel = (groupKey: string) => (groupKey === NO_GROUP ? "ไม่ระบุกลุ่ม" : `กลุ่ม ${groupKey}`)

export interface RoundWindow extends WindowTimes {
  round: QuizRound
  groupKey: string
}

export interface WindowSlot {
  opensAt: string | null
  closesAt: string | null
  state: RoundWindowState
}

export interface WindowGridRow {
  groupKey: string
  label: string
  windows: Record<QuizRound, WindowSlot>
}

const slotKey = (round: string, groupKey: string) => `${round}\u0000${groupKey}`

interface WindowRow {
  quiz_id: number
  round: QuizRound
  group_key: string
  opens_at: Date | string | null
  closes_at: Date | string | null
}

const date = (v: Date | string | null) => (v === null ? null : new Date(v))
const toWindow = (r: WindowRow): RoundWindow => ({
  round: r.round,
  groupKey: r.group_key,
  opensAt: date(r.opens_at),
  closesAt: date(r.closes_at),
})

export async function listWindows(db: Queryable, quizId: number): Promise<RoundWindow[]> {
  const { rows } = await db.query<WindowRow>(
    `SELECT quiz_id, round, group_key, opens_at, closes_at FROM quiz_windows WHERE quiz_id = $1::int`,
    [quizId]
  )
  return rows.map(toWindow)
}

/** One Group's windows for every Quiz of a course, by Quiz id. */
export async function listGroupWindows(
  db: Queryable,
  key: CourseKey,
  groupKey: string
): Promise<Map<number, RoundWindow[]>> {
  const { rows } = await db.query<WindowRow>(
    `SELECT w.quiz_id, w.round, w.group_key, w.opens_at, w.closes_at
     FROM quiz_windows w JOIN quizzes q ON q.id = w.quiz_id
     WHERE q.course_code = $1 AND q.course_year = $2::int AND q.course_semester = $3::int
       AND w.group_key = $4`,
    [key.code, key.year, key.semester, groupKey]
  )
  const byQuiz = new Map<number, RoundWindow[]>()
  for (const r of rows) byQuiz.set(r.quiz_id, [...(byQuiz.get(r.quiz_id) ?? []), toWindow(r)])
  return byQuiz
}

/** A Group's Pre and Post window (absent = never opened) — state judged at `now`. */
export function groupRoundWindows(
  windows: RoundWindow[],
  groupKey: string,
  now: Date
): Record<QuizRound, WindowSlot> {
  return windowGrid([groupKey], windows, now)[0].windows
}

/** Replace the given slots (delete + insert — no upsert, for pg-mem). */
export async function saveWindows(db: Queryable, quizId: number, windows: RoundWindow[]): Promise<void> {
  for (const w of windows) {
    await db.query(`DELETE FROM quiz_windows WHERE quiz_id = $1::int AND round = $2 AND group_key = $3`, [
      quizId,
      w.round,
      w.groupKey,
    ])
    await db.query(
      `INSERT INTO quiz_windows (quiz_id, round, group_key, opens_at, closes_at) VALUES ($1::int, $2, $3, $4, $5)`,
      [quizId, w.round, w.groupKey, w.opensAt, w.closesAt]
    )
  }
}

/**
 * The Groups a Quiz's windows are set for: every roster Group, then
 * ไม่ระบุกลุ่ม — plus any Group that still has a stored window (a Group whose
 * students all left keeps its row rather than vanishing).
 */
export async function quizGroups(db: Queryable, key: CourseKey, stored: RoundWindow[]): Promise<string[]> {
  const named = new Set((await listGroups(db, key)).map(groupKeyOf).filter((g) => g !== NO_GROUP))
  for (const w of stored) if (w.groupKey !== NO_GROUP) named.add(w.groupKey)
  const sorted = [...named].sort((a, b) => a.localeCompare(b, "th", { numeric: true }))
  return [...sorted, NO_GROUP]
}

export function windowGrid(groups: string[], stored: RoundWindow[], now: Date): WindowGridRow[] {
  const byKey = new Map(stored.map((w) => [slotKey(w.round, w.groupKey), w]))
  const slot = (round: QuizRound, groupKey: string): WindowSlot => {
    const w = byKey.get(slotKey(round, groupKey)) ?? { opensAt: null, closesAt: null }
    return {
      opensAt: w.opensAt?.toISOString() ?? null,
      closesAt: w.closesAt?.toISOString() ?? null,
      state: roundWindow(w, now),
    }
  }
  return groups.map((groupKey) => ({
    groupKey,
    label: groupLabel(groupKey),
    windows: Object.fromEntries(QUIZ_ROUNDS.map((r) => [r, slot(r, groupKey)])) as Record<QuizRound, WindowSlot>,
  }))
}

type InstantChange = { keep: true } | { keep: false; value: Date | null }

function parseInstant(v: unknown, now: Date): InstantChange | null {
  if (v === undefined) return { keep: true }
  if (v === null) return { keep: false, value: null }
  if (v === "now") return { keep: false, value: now }
  if (typeof v !== "string") return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : { keep: false, value: d }
}

/**
 * Merge a staff edit over the stored windows and check it. Each change names a
 * slot (`round`, `groupKey`) and sets `opensAt` / `closesAt` to an ISO instant,
 * `"now"` (the server clock) or null; an omitted instant keeps its value.
 * Returns the merged slots to save, or the first error.
 */
export function mergeWindowChanges(
  changes: unknown,
  ctx: { stored: RoundWindow[]; groups: string[]; now: Date }
): { ok: true; windows: RoundWindow[] } | { ok: false; error: string } {
  if (!Array.isArray(changes) || changes.length === 0) return { ok: false, error: "ไม่มีช่วงเวลาที่จะบันทึก" }

  const merged = new Map(ctx.stored.map((w) => [slotKey(w.round, w.groupKey), w]))
  const changed: RoundWindow[] = []
  for (const c of changes) {
    if (typeof c !== "object" || c === null) return { ok: false, error: "ข้อมูลช่วงเวลาไม่ถูกต้อง" }
    const { round, groupKey, opensAt, closesAt } = c as Record<string, unknown>
    if (!isQuizRound(round)) return { ok: false, error: "รอบไม่ถูกต้อง (pre / post)" }
    if (typeof groupKey !== "string" || !ctx.groups.includes(groupKey)) {
      return { ok: false, error: "ไม่พบกลุ่มนี้ในรายวิชา" }
    }
    const key = slotKey(round, groupKey)
    if (changed.some((w) => slotKey(w.round, w.groupKey) === key)) {
      return { ok: false, error: `${groupLabel(groupKey)} ${QUIZ_ROUND_LABEL[round]} ซ้ำกัน` }
    }
    const open = parseInstant(opensAt, ctx.now)
    const close = parseInstant(closesAt, ctx.now)
    if (!open || !close) return { ok: false, error: "วันเวลาไม่ถูกต้อง" }

    const base = merged.get(key) ?? { opensAt: null, closesAt: null }
    const next: RoundWindow = {
      round,
      groupKey,
      opensAt: open.keep ? base.opensAt : open.value,
      closesAt: close.keep ? base.closesAt : close.value,
    }
    if (next.opensAt && next.closesAt && next.closesAt <= next.opensAt) {
      return { ok: false, error: `${groupLabel(groupKey)}: เวลาปิดต้องหลังเวลาเปิด` }
    }
    merged.set(key, next)
    changed.push(next)
  }

  // Pre and Post of one Group must not overlap; different Groups may.
  for (const groupKey of new Set(changed.map((w) => w.groupKey))) {
    const [pre, post] = QUIZ_ROUNDS.map((r) => merged.get(slotKey(r, groupKey)))
    if (pre && post && windowsOverlap(pre, post)) {
      return { ok: false, error: `${groupLabel(groupKey)}: ช่วงเวลา Pre-test และ Post-test ทับกัน` }
    }
  }
  return { ok: true, windows: changed }
}
