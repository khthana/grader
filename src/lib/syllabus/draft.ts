// Syllabus Draft (#99) — the one place a Syllabus body is validated and
// normalized, like the Problem Draft (#83). The route never validates the raw
// body itself; what comes out here is exactly what gets written.

import { isPlanWeek, planErrorKey, sortPlan, MAX_PLAN_WEEK, MIN_PLAN_WEEK, type PlanEntry } from "./plan"

/** A Course offering's Syllabus as stored (staff are read live, never stored). */
export interface Syllabus {
  credits: string
  description: string
  objectives: string
  /** The Teaching Plan (#100), sorted by week. */
  plan: PlanEntry[]
}

export const EMPTY_SYLLABUS: Syllabus = { credits: "", description: "", objectives: "", plan: [] }

const TEXT_FIELDS = ["credits", "description", "objectives"] as const

export type SyllabusDraftResult =
  | { ok: true; draft: Syllabus }
  | { ok: false; errors: Record<string, string> }

type Errors = Record<string, string>

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

// A PUT replaces the whole Syllabus, so a field left out is cleared. A
// wrong-typed field is a field error (a 400), never a crash further down.
export function buildSyllabusDraft(body: unknown): SyllabusDraftResult {
  if (!isObject(body)) return { ok: false, errors: { body: "ข้อมูลไม่ถูกต้อง" } }
  const errors: Errors = {}
  const draft: Syllabus = { ...EMPTY_SYLLABUS, plan: buildPlan(body.plan, errors) }
  for (const key of TEXT_FIELDS) {
    const value = body[key]
    if (value == null) continue
    if (typeof value !== "string") errors[key] = `${key} ต้องเป็นข้อความ`
    else draft[key] = value.trim()
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, draft }
}

// Errors are keyed by the entry's position as sent (`plan.2.topic`), which is
// the editor's row order; the plan is sorted only once it is valid.
function buildPlan(value: unknown, errors: Errors): PlanEntry[] {
  if (value == null) return []
  if (!Array.isArray(value)) {
    errors.plan = "แผนการสอนไม่ถูกต้อง"
    return []
  }
  const entries: PlanEntry[] = []
  value.forEach((raw, i) => {
    if (!isObject(raw)) {
      errors[planErrorKey(i)] = "แถวแผนการสอนไม่ถูกต้อง"
      return
    }
    if (!isPlanWeek(raw.weekNo)) errors[planErrorKey(i, "weekNo")] = `สัปดาห์ต้องเป็นจำนวนเต็ม ${MIN_PLAN_WEEK}–${MAX_PLAN_WEEK}`
    const topic = typeof raw.topic === "string" ? raw.topic.trim() : ""
    if (typeof raw.topic !== "string" || topic === "") errors[planErrorKey(i, "topic")] = "กรุณากรอกหัวข้อ"
    if (raw.detail != null && typeof raw.detail !== "string") errors[planErrorKey(i, "detail")] = "รายละเอียดต้องเป็นข้อความ"
    const detail = typeof raw.detail === "string" ? raw.detail.trim() : ""
    entries.push({ weekNo: raw.weekNo as number, topic, detail })
  })
  return sortPlan(entries)
}

/** Nothing written yet — viewers see "ยังไม่มีประมวลรายวิชา". */
export function isSyllabusEmpty(syllabus: Syllabus): boolean {
  return TEXT_FIELDS.every((key) => syllabus[key] === "") && syllabus.plan.length === 0
}
